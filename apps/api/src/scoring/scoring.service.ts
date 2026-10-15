import { readFile } from 'node:fs/promises';
import {
  type ScoreResult,
  type ScorerDefinition,
  type ScorerType,
  scorerId,
  type TaskDefinition,
  type TrajectoryEvent,
} from '@agent-evals/shared';
import { Inject, Injectable } from '@nestjs/common';
import { WorkspaceService } from '../execution/workspace.service';
import type { RunDirectories } from '../execution/agent-runner';
import { type ScoreContext, type Scorer, SCORERS } from './scorer';

export interface TaskScore {
  /** Weighted mean of scorer scores, 0–1. */
  score: number;
  passed: boolean;
  results: ScoreResult[];
}

/**
 * Task score = weighted mean of scorer scores. A task passes when every
 * required scorer passes and either every scorer passes (default) or the
 * weighted score reaches the task's `passThreshold` (partial credit).
 */
export function aggregate(task: TaskDefinition, results: ScoreResult[]): TaskScore {
  const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
  const score =
    totalWeight > 0 ? results.reduce((sum, r) => sum + r.weight * r.score, 0) / totalWeight : 0;
  const requiredOk = results.every((r) => !r.required || r.passed);
  const threshold = task.scoring.passThreshold;
  const thresholdOk =
    threshold === undefined ? results.every((r) => r.passed) : score >= threshold - 1e-9;
  return { score, passed: requiredOk && thresholdOk, results };
}

@Injectable()
export class ScoringService {
  private readonly registry: Map<ScorerType, Scorer>;

  constructor(
    @Inject(SCORERS) scorers: Scorer[],
    private readonly workspace: WorkspaceService,
  ) {
    this.registry = new Map(scorers.map((s) => [s.type, s]));
  }

  async score(input: {
    task: TaskDefinition;
    finalAnswer: string;
    events: TrajectoryEvent[];
    dirs: RunDirectories;
    signal: AbortSignal;
  }): Promise<TaskScore> {
    const { task, dirs } = input;
    const context: ScoreContext = {
      task,
      finalAnswer: input.finalAnswer,
      events: input.events,
      workspaceDir: dirs.workspace,
      signal: input.signal,
      readTarget: async (target) => {
        if (target === 'final_answer') return input.finalAnswer;
        const path = this.workspace.resolveInside(dirs.workspace, target.slice('file:'.length));
        try {
          return await readFile(path, 'utf8');
        } catch {
          return null;
        }
      },
      addHiddenFixtures: (relativeDir) => this.workspace.addHiddenFixtures(dirs, relativeDir),
    };

    // Sequential on purpose: command scorers mutate the workspace (hidden fixtures).
    const results: ScoreResult[] = [];
    for (const [index, definition] of task.scoring.scorers.entries()) {
      results.push(await this.runScorer(definition, index, context));
    }
    return aggregate(task, results);
  }

  private async runScorer(
    definition: ScorerDefinition,
    index: number,
    context: ScoreContext,
  ): Promise<ScoreResult> {
    const base = {
      scorerId: scorerId(definition, index),
      type: definition.type,
      description: definition.description ?? null,
      weight: definition.weight,
      required: definition.required,
    };
    const scorer = this.registry.get(definition.type);
    try {
      if (!scorer) throw new Error(`No scorer registered for type "${definition.type}"`);
      // The registry guarantees the definition matches the scorer's type.
      const outcome = await scorer.score(definition as never, context);
      return {
        ...base,
        score: Math.min(1, Math.max(0, outcome.score)),
        passed: outcome.passed,
        status: 'ok',
        reason: outcome.reason,
        evidence: outcome.evidence ?? null,
      };
    } catch (error) {
      return {
        ...base,
        score: 0,
        passed: false,
        status: 'error',
        reason: `Scorer error: ${(error as Error).message}`,
        evidence: null,
      };
    }
  }
}
