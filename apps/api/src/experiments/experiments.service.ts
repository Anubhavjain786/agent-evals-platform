import { randomInt, randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  CreateExperimentCommand,
  ExperimentDetail,
  ExperimentReport,
  ExperimentSnapshot,
  ExperimentSummary,
  RunDetail,
  RunListQuery,
  RunSummary,
  WorkspaceFileContent,
} from '@agent-evals/shared';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { buildReport } from '../analysis/report.builder';
import { nowIso } from '../common/time';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import type { ExperimentRow, RunRow } from '../database/schema';
import { AgentConfigsService } from '../definitions/agent-configs.service';
import { SuitesService } from '../definitions/suites.service';
import { EventBus } from '../events/event-bus.service';
import { WorkspaceService } from '../execution/workspace.service';
import { ExperimentsRepository } from './experiments.repository';
import { planRuns } from './run-plan';
import { RunsRepository, toRunSummary } from './runs.repository';

const ACTIVE = new Set(['queued', 'running']);

@Injectable()
export class ExperimentsService {
  private readonly logger = new Logger(ExperimentsService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly experiments: ExperimentsRepository,
    private readonly runs: RunsRepository,
    private readonly suites: SuitesService,
    private readonly agentConfigs: AgentConfigsService,
    private readonly workspace: WorkspaceService,
    private readonly bus: EventBus,
  ) {}

  create(command: CreateExperimentCommand): ExperimentDetail {
    const suite = this.suites.get(command.suiteId);
    const configRows = this.agentConfigs.getMany(command.configIds);

    const tasks = command.taskIds
      ? command.taskIds.map((id) => {
          const task = suite.definition.tasks.find((t) => t.id === id);
          if (!task) throw new BadRequestException(`Task "${id}" is not in suite "${suite.id}"`);
          return task;
        })
      : suite.definition.tasks;

    // Freeze every definition: later edits must not change what this experiment means.
    const snapshot: ExperimentSnapshot = {
      suite: { ...suite.definition, tasks },
      suiteVersion: suite.version,
      configs: configRows.map((row) => row.definition),
      configVersions: Object.fromEntries(configRows.map((row) => [row.id, row.version])),
    };

    const id = randomUUID();
    const seed = command.seed ?? randomInt(0, 2 ** 31 - 1);
    const experiment: ExperimentRow = {
      id,
      name: command.name,
      description: command.description ?? null,
      suiteId: suite.id,
      baselineConfigId: command.baselineConfigId ?? command.configIds[0]!,
      status: 'queued',
      trials: command.trials,
      concurrency: command.concurrency,
      seed,
      snapshot,
      createdAt: nowIso(),
      startedAt: null,
      finishedAt: null,
    };
    const plan = planRuns({
      experimentId: id,
      taskIds: tasks.map((t) => t.id),
      configIds: command.configIds,
      trials: command.trials,
      seed,
    });
    this.experiments.create(experiment, plan);
    this.logger.log(`Experiment ${id} created with ${plan.length} runs`);
    this.bus.publishDomain({ type: 'experiment.launched', experimentId: id });
    return this.get(id);
  }

  list(): ExperimentSummary[] {
    const rows = this.experiments.findAll();
    const aggregates = this.runs.aggregates(rows.map((r) => r.id));
    return rows.map((row) => this.toSummary(row, aggregates.get(row.id)));
  }

  get(id: string): ExperimentDetail {
    const row = this.findOrThrow(id);
    const aggregate = this.runs.aggregates([id]).get(id);
    return { ...this.toSummary(row, aggregate), snapshot: row.snapshot };
  }

  report(id: string): ExperimentReport {
    const row = this.findOrThrow(id);
    const runs = this.runs.list(id);
    const scorerErrors = this.runs.runIdsWithScorerErrors(id);
    return buildReport({
      experimentId: id,
      status: row.status,
      baselineConfigId: row.baselineConfigId,
      trials: row.trials,
      seed: row.seed,
      snapshot: row.snapshot,
      runs: runs.map((run) => ({
        taskId: run.taskId,
        configId: run.configId,
        status: run.status,
        outcome: run.outcome,
        score: run.score,
        costUsd: run.costUsd,
        durationMs: run.durationMs,
        totalTokens: run.totalTokens,
        toolCalls: run.toolCalls,
        hasScorerError: scorerErrors.has(run.id),
      })),
    });
  }

  cancel(id: string): ExperimentDetail {
    const row = this.findOrThrow(id);
    if (!ACTIVE.has(row.status)) throw new ConflictException(`Experiment is already ${row.status}`);
    const cancelled = this.runs.cancelQueued(id);
    this.experiments.update(id, { status: 'cancelled', finishedAt: nowIso() });
    this.bus.publishDomain({ type: 'experiment.cancelled', experimentId: id });
    this.logger.log(`Experiment ${id} cancelled (${cancelled} queued runs dropped)`);
    this.publishProgress(id);
    return this.get(id);
  }

  /** Re-queues runs that ended in infrastructure errors (or were cancelled) and resumes the experiment. */
  retryFailedRuns(id: string): ExperimentDetail {
    this.findOrThrow(id);
    const requeued = this.runs.requeueErrored(id);
    if (requeued === 0)
      throw new ConflictException('There are no errored or cancelled runs to retry');
    this.experiments.update(id, { status: 'running', finishedAt: null });
    this.bus.publishDomain({ type: 'experiment.launched', experimentId: id });
    this.publishProgress(id);
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    const row = this.findOrThrow(id);
    if (ACTIVE.has(row.status))
      throw new ConflictException('Cancel the experiment before deleting it');
    const runIds = this.runs.list(id).map((r) => r.id);
    this.experiments.delete(id);
    await Promise.all(
      runIds.map((runId) =>
        rm(join(this.config.dataDir, 'runs', runId), { recursive: true, force: true }),
      ),
    );
  }

  listRuns(id: string, query: RunListQuery): RunSummary[] {
    this.findOrThrow(id);
    return this.runs.list(id, query).map(toRunSummary);
  }

  getRun(runId: string): RunDetail {
    const run = this.findRunOrThrow(runId);
    const experiment = this.findOrThrow(run.experimentId);
    const task = experiment.snapshot.suite.tasks.find((t) => t.id === run.taskId);
    const config = experiment.snapshot.configs.find((c) => c.id === run.configId);
    if (!task || !config)
      throw new NotFoundException('Run references a definition missing from its snapshot');
    return {
      ...toRunSummary(run),
      task,
      config,
      finalAnswer: run.finalAnswer,
      exitCode: run.exitCode,
      turnExitReason: run.turnExitReason,
      sessionId: run.sessionId,
      usage: run.usage,
      scores: this.runs.scores(runId),
      events: this.runs.events(runId),
      files: run.files ?? [],
      logTail: run.logTail,
    };
  }

  readRunFile(runId: string, path: string): Promise<WorkspaceFileContent> {
    this.findRunOrThrow(runId);
    return this.workspace.readFile(runId, path);
  }

  // ─── Lifecycle hooks used by the scheduler ────────────────────────────────

  onRunStarted(run: RunRow): void {
    const row = this.experiments.findById(run.experimentId);
    if (row?.status === 'queued') {
      this.experiments.update(row.id, { status: 'running', startedAt: row.startedAt ?? nowIso() });
    }
    this.bus.publishLive({
      type: 'run.updated',
      experimentId: run.experimentId,
      run: toRunSummary(run),
    });
    this.publishProgress(run.experimentId);
  }

  onRunSettled(runId: string): void {
    const run = this.runs.findById(runId);
    if (!run) return;
    this.bus.publishLive({
      type: 'run.updated',
      experimentId: run.experimentId,
      run: toRunSummary(run),
    });
    const row = this.experiments.findById(run.experimentId);
    const progress = this.runs.aggregates([run.experimentId]).get(run.experimentId)!.progress;
    if (row && ACTIVE.has(row.status) && progress.queued + progress.running === 0) {
      this.experiments.update(row.id, { status: 'completed', finishedAt: nowIso() });
      this.logger.log(`Experiment ${row.id} completed`);
    }
    this.publishProgress(run.experimentId);
  }

  private publishProgress(id: string): void {
    const row = this.experiments.findById(id);
    if (!row) return;
    const progress = this.runs.aggregates([id]).get(id)!.progress;
    this.bus.publishLive({
      type: 'experiment.updated',
      experimentId: id,
      status: row.status,
      progress,
    });
  }

  private findOrThrow(id: string): ExperimentRow {
    const row = this.experiments.findById(id);
    if (!row) throw new NotFoundException(`Experiment "${id}" not found`);
    return row;
  }

  private findRunOrThrow(id: string): RunRow {
    const run = this.runs.findById(id);
    if (!run) throw new NotFoundException(`Run "${id}" not found`);
    return run;
  }

  private toSummary(
    row: ExperimentRow,
    aggregate: { progress: ExperimentSummary['progress']; costUsd: number } | undefined,
  ): ExperimentSummary {
    const { snapshot } = row;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      suite: { id: snapshot.suite.id, name: snapshot.suite.name, version: snapshot.suiteVersion },
      configs: snapshot.configs.map((c) => ({
        id: c.id,
        name: c.name,
        version: snapshot.configVersions[c.id] ?? '',
      })),
      baselineConfigId: row.baselineConfigId,
      status: row.status,
      trials: row.trials,
      taskCount: snapshot.suite.tasks.length,
      concurrency: row.concurrency,
      seed: row.seed,
      progress: aggregate?.progress ?? {
        total: 0,
        queued: 0,
        running: 0,
        completed: 0,
        error: 0,
        cancelled: 0,
      },
      totalCostUsd: aggregate?.costUsd ?? 0,
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
    };
  }
}
