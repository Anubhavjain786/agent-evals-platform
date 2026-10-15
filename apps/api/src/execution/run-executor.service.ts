import { setTimeout as sleep } from 'node:timers/promises';
import type { RunErrorKind, TrajectoryEvent } from '@agent-evals/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import type { RunRow } from '../database/schema';
import { EventBus } from '../events/event-bus.service';
import { ExperimentsRepository } from '../experiments/experiments.repository';
import { RunsRepository } from '../experiments/runs.repository';
import { ScoringService } from '../scoring/scoring.service';
import {
  AGENT_RUNNER,
  type AgentRunner,
  type AgentRunResult,
  type RunDirectories,
  type RunnerEvent,
} from './agent-runner';
import { isInfraError } from './hermes/usage';
import { WorkspaceService } from './workspace.service';

/** Abort reason used on shutdown: the run is re-queued on next boot instead of cancelled. */
export const SHUTDOWN = 'shutdown';
const RETRY_MAX_DELAY_MS = 60_000;

/**
 * Executes one claimed run end to end: prepare workspace → run the agent →
 * snapshot the workspace → score → persist. Infrastructure errors are retried
 * up to RUN_MAX_ATTEMPTS; agent failures are scored like any other outcome.
 */
@Injectable()
export class RunExecutor {
  private readonly logger = new Logger(RunExecutor.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(AGENT_RUNNER) private readonly runner: AgentRunner,
    private readonly experiments: ExperimentsRepository,
    private readonly runs: RunsRepository,
    private readonly workspace: WorkspaceService,
    private readonly scoring: ScoringService,
    private readonly bus: EventBus,
  ) {}

  async execute(run: RunRow, signal: AbortSignal): Promise<void> {
    const experiment = this.experiments.findById(run.experimentId);
    const task = experiment?.snapshot.suite.tasks.find((t) => t.id === run.taskId);
    const agentConfig = experiment?.snapshot.configs.find((c) => c.id === run.configId);
    if (!task || !agentConfig) {
      this.runs.markError(run.id, {
        errorKind: 'harness',
        errorMessage: 'Task or config missing from experiment snapshot',
      });
      return;
    }

    const events: TrajectoryEvent[] = [];
    const onEvent = (event: RunnerEvent): void => {
      const withSeq = { ...event, seq: events.length } as TrajectoryEvent;
      events.push(withSeq);
      this.runs.appendEvent(run.id, withSeq);
      this.bus.publishLive({
        type: 'run.event',
        experimentId: run.experimentId,
        runId: run.id,
        event: withSeq,
      });
    };

    let dirs: RunDirectories | null = null;
    try {
      const prepared = await this.workspace.prepare(run.id, task);
      dirs = prepared.dirs;
      if (signal.aborted) {
        // Cancelled while the workspace was being prepared: do not start the agent.
        if (signal.reason !== SHUTDOWN) this.runs.markCancelled(run.id);
        return;
      }
      const result = await this.runner.run({
        runId: run.id,
        task,
        config: agentConfig,
        dirs,
        maxTurns: task.limits.maxTurns ?? agentConfig.maxTurns,
        timeoutMs: task.limits.timeoutSec * 1000,
        signal,
        onEvent,
      });

      if (result.status === 'cancelled') {
        if (signal.reason !== SHUTDOWN) this.runs.markCancelled(run.id);
        return;
      }
      if (result.status === 'infra_error') {
        await this.handleInfraError(run, result, signal);
        return;
      }

      const files = await this.workspace.snapshot(dirs, prepared.manifest);
      const scored = await this.scoring.score({
        task,
        finalAnswer: result.finalAnswer,
        events,
        dirs,
        signal,
      });
      this.runs.complete(
        run.id,
        {
          outcome: scored.passed ? 'pass' : 'fail',
          score: scored.score,
          errorKind:
            result.status === 'timeout'
              ? 'timeout'
              : result.status === 'max_turns'
                ? 'max_turns'
                : null,
          errorMessage: result.errorMessage,
          finalAnswer: result.finalAnswer,
          exitCode: result.exitCode,
          turnExitReason: result.turnExitReason,
          sessionId: result.sessionId,
          usage: result.usage,
          toolCalls: events.filter((e) => e.type === 'tool_call').length,
          durationMs: result.durationMs,
          files,
          logTail: result.logTail,
        },
        scored.results,
      );
    } catch (error) {
      if (signal.aborted && signal.reason === SHUTDOWN) return;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Run ${run.id} crashed: ${error instanceof Error ? error.stack : message}`);
      await this.retryOrFail(run, 'harness', `Harness error: ${message}`, signal);
    } finally {
      if (dirs) await this.workspace.cleanup(dirs).catch(() => undefined);
    }
  }

  private async handleInfraError(
    run: RunRow,
    result: AgentRunResult,
    signal: AbortSignal,
  ): Promise<void> {
    const message = result.errorMessage ?? 'Infrastructure error';
    const kind: RunErrorKind = isInfraError(message) ? 'provider' : 'harness';
    this.logger.warn(
      `Run ${run.id} attempt ${run.attempt} infra error (${kind}): ${message.slice(0, 300)}`,
    );
    await this.retryOrFail(run, kind, message, signal, result);
  }

  private async retryOrFail(
    run: RunRow,
    kind: RunErrorKind,
    message: string,
    signal: AbortSignal,
    result?: AgentRunResult,
  ): Promise<void> {
    if (run.attempt < this.config.runMaxAttempts) {
      // Back off while holding the slot: throttled providers recover instead of being hammered.
      const delay = Math.min(
        RETRY_MAX_DELAY_MS,
        this.config.retryBaseDelayMs * 2 ** (run.attempt - 1),
      );
      await sleep(delay, undefined, { signal }).catch(() => undefined);
      if (signal.aborted && signal.reason !== SHUTDOWN) {
        this.runs.markCancelled(run.id);
        return;
      }
      this.runs.requeue(run.id, run.attempt + 1);
      return;
    }
    this.runs.markError(run.id, {
      errorKind: kind,
      errorMessage: message,
      usage: result?.usage ?? null,
      durationMs: result?.durationMs ?? null,
      logTail: result?.logTail ?? null,
    });
  }
}
