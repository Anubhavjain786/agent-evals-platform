import type {
  ExperimentProgress,
  RunErrorKind,
  RunListQuery,
  RunOutcome,
  RunStatus,
  RunSummary,
  RunUsage,
  ScoreResult,
  TrajectoryEvent,
  WorkspaceFile,
} from '@agent-evals/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { nowIso } from '../common/time';
import { DB, type Db } from '../database/database.module';
import { runEvents, type RunRow, runs, scoreResults } from '../database/schema';

export type NewRun = Pick<
  RunRow,
  'id' | 'experimentId' | 'taskId' | 'configId' | 'trial' | 'queueOrder'
>;

export interface RunCompletion {
  outcome: RunOutcome;
  score: number;
  errorKind: RunErrorKind | null;
  errorMessage: string | null;
  finalAnswer: string;
  exitCode: number | null;
  turnExitReason: string | null;
  sessionId: string | null;
  usage: RunUsage;
  toolCalls: number;
  durationMs: number;
  files: WorkspaceFile[];
  logTail: string;
}

const EMPTY_PROGRESS: ExperimentProgress = {
  total: 0,
  queued: 0,
  running: 0,
  completed: 0,
  error: 0,
  cancelled: 0,
};

/** Fields cleared when a run goes back to the queue. */
const RESET_FIELDS = {
  outcome: null,
  score: null,
  errorKind: null,
  errorMessage: null,
  finalAnswer: null,
  exitCode: null,
  turnExitReason: null,
  sessionId: null,
  usage: null,
  costUsd: null,
  totalTokens: null,
  toolCalls: null,
  durationMs: null,
  files: null,
  logTail: null,
  startedAt: null,
  finishedAt: null,
} as const;

export function toRunSummary(row: RunRow): RunSummary {
  return {
    id: row.id,
    experimentId: row.experimentId,
    taskId: row.taskId,
    configId: row.configId,
    trial: row.trial,
    attempt: row.attempt,
    status: row.status,
    outcome: row.outcome,
    score: row.score,
    errorKind: row.errorKind,
    errorMessage: row.errorMessage,
    durationMs: row.durationMs,
    costUsd: row.costUsd,
    totalTokens: row.totalTokens,
    toolCalls: row.toolCalls,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

/**
 * Run persistence. better-sqlite3 is synchronous and the scheduler lives in a
 * single process, so claim-and-mark is atomic without extra locking.
 */
@Injectable()
export class RunsRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Claims the next queued run, honouring each experiment's concurrency limit.
   * Older experiments are served first; within one, the shuffled queue order.
   */
  claimNext(): RunRow | undefined {
    return this.db.transaction((tx) => {
      const candidate = tx.get<{ id: string }>(sql`
        SELECT r.id AS id
        FROM runs r
        JOIN experiments e ON e.id = r.experiment_id
        WHERE r.status = 'queued'
          AND e.status IN ('queued', 'running')
          AND (SELECT COUNT(*) FROM runs x
               WHERE x.experiment_id = r.experiment_id AND x.status = 'running') < e.concurrency
        ORDER BY e.created_at, r.queue_order
        LIMIT 1`);
      if (!candidate) return undefined;
      return tx
        .update(runs)
        .set({ status: 'running', startedAt: nowIso() })
        .where(and(eq(runs.id, candidate.id), eq(runs.status, 'queued')))
        .returning()
        .get();
    });
  }

  appendEvent(runId: string, event: TrajectoryEvent): void {
    const { seq, ts, type, ...payload } = event;
    this.db.insert(runEvents).values({ runId, seq, ts, type, payload }).run();
  }

  complete(runId: string, completion: RunCompletion, scores: ScoreResult[]): RunRow {
    return this.db.transaction((tx) => {
      tx.delete(scoreResults).where(eq(scoreResults.runId, runId)).run();
      scores.forEach((s, position) =>
        tx
          .insert(scoreResults)
          .values({ runId, position, ...s })
          .run(),
      );
      return tx
        .update(runs)
        .set({
          status: 'completed',
          outcome: completion.outcome,
          score: completion.score,
          errorKind: completion.errorKind,
          errorMessage: completion.errorMessage,
          finalAnswer: completion.finalAnswer,
          exitCode: completion.exitCode,
          turnExitReason: completion.turnExitReason,
          sessionId: completion.sessionId,
          usage: completion.usage,
          costUsd: completion.usage.costUsd,
          totalTokens: completion.usage.totalTokens,
          toolCalls: completion.toolCalls,
          durationMs: completion.durationMs,
          files: completion.files,
          logTail: completion.logTail,
          finishedAt: nowIso(),
        })
        .where(eq(runs.id, runId))
        .returning()
        .get();
    });
  }

  /** Terminal infrastructure failure: kept for inspection, excluded from statistics. */
  markError(
    runId: string,
    fields: {
      errorKind: RunErrorKind;
      errorMessage: string;
      usage?: RunUsage | null;
      durationMs?: number | null;
      logTail?: string | null;
    },
  ): RunRow {
    return this.db
      .update(runs)
      .set({
        status: 'error',
        errorKind: fields.errorKind,
        errorMessage: fields.errorMessage,
        usage: fields.usage ?? null,
        costUsd: fields.usage?.costUsd ?? null,
        totalTokens: fields.usage?.totalTokens ?? null,
        durationMs: fields.durationMs ?? null,
        logTail: fields.logTail ?? null,
        finishedAt: nowIso(),
      })
      .where(eq(runs.id, runId))
      .returning()
      .get();
  }

  markCancelled(runId: string): RunRow {
    return this.db
      .update(runs)
      .set({
        status: 'cancelled',
        errorKind: 'cancelled',
        errorMessage: 'Run cancelled',
        finishedAt: nowIso(),
      })
      .where(eq(runs.id, runId))
      .returning()
      .get();
  }

  /** Puts a run back at the end of its experiment's queue for another attempt. */
  requeue(runId: string, nextAttempt: number): RunRow {
    return this.db.transaction((tx) => {
      tx.delete(runEvents).where(eq(runEvents.runId, runId)).run();
      tx.delete(scoreResults).where(eq(scoreResults.runId, runId)).run();
      const { max } = tx.get<{ max: number }>(
        sql`SELECT COALESCE(MAX(queue_order), 0) AS max FROM runs
            WHERE experiment_id = (SELECT experiment_id FROM runs WHERE id = ${runId})`,
      );
      return tx
        .update(runs)
        .set({ ...RESET_FIELDS, status: 'queued', attempt: nextAttempt, queueOrder: max + 1 })
        .where(eq(runs.id, runId))
        .returning()
        .get();
    });
  }

  /** Runs left `running` by a crash or restart go back to the queue (their partial output is discarded). */
  requeueInterrupted(): number {
    return this.db.transaction((tx) => {
      const stale = tx.select({ id: runs.id }).from(runs).where(eq(runs.status, 'running')).all();
      const ids = stale.map((r) => r.id);
      if (ids.length === 0) return 0;
      tx.delete(runEvents).where(inArray(runEvents.runId, ids)).run();
      tx.delete(scoreResults).where(inArray(scoreResults.runId, ids)).run();
      tx.update(runs)
        .set({ ...RESET_FIELDS, status: 'queued' })
        .where(inArray(runs.id, ids))
        .run();
      return ids.length;
    });
  }

  cancelQueued(experimentId: string): number {
    return this.db
      .update(runs)
      .set({
        status: 'cancelled',
        errorKind: 'cancelled',
        errorMessage: 'Experiment cancelled',
        finishedAt: nowIso(),
      })
      .where(and(eq(runs.experimentId, experimentId), eq(runs.status, 'queued')))
      .run().changes;
  }

  /** Re-queues runs that ended in an infrastructure error, with a fresh attempt budget. */
  requeueErrored(experimentId: string): number {
    const errored = this.db
      .select({ id: runs.id })
      .from(runs)
      .where(and(eq(runs.experimentId, experimentId), inArray(runs.status, ['error', 'cancelled'])))
      .all();
    for (const { id } of errored) this.requeue(id, 1);
    return errored.length;
  }

  findById(id: string): RunRow | undefined {
    return this.db.select().from(runs).where(eq(runs.id, id)).get();
  }

  list(experimentId: string, query: RunListQuery = {}): RunRow[] {
    const conditions = [eq(runs.experimentId, experimentId)];
    if (query.configId) conditions.push(eq(runs.configId, query.configId));
    if (query.taskId) conditions.push(eq(runs.taskId, query.taskId));
    if (query.status) conditions.push(eq(runs.status, query.status));
    if (query.outcome) conditions.push(eq(runs.outcome, query.outcome));
    return this.db
      .select()
      .from(runs)
      .where(and(...conditions))
      .orderBy(asc(runs.taskId), asc(runs.configId), asc(runs.trial))
      .all();
  }

  events(runId: string): TrajectoryEvent[] {
    return this.db
      .select()
      .from(runEvents)
      .where(eq(runEvents.runId, runId))
      .orderBy(asc(runEvents.seq))
      .all()
      .map(
        (row) => ({ ...row.payload, seq: row.seq, ts: row.ts, type: row.type }) as TrajectoryEvent,
      );
  }

  scores(runId: string): ScoreResult[] {
    return this.db
      .select()
      .from(scoreResults)
      .where(eq(scoreResults.runId, runId))
      .orderBy(asc(scoreResults.position))
      .all()
      .map(
        ({
          scorerId,
          type,
          description,
          weight,
          required,
          score,
          passed,
          status,
          reason,
          evidence,
        }) => ({
          scorerId,
          type,
          description,
          weight,
          required,
          score,
          passed,
          status,
          reason,
          evidence,
        }),
      );
  }

  runIdsWithScorerErrors(experimentId: string): Set<string> {
    const rows = this.db
      .selectDistinct({ runId: scoreResults.runId })
      .from(scoreResults)
      .innerJoin(runs, eq(runs.id, scoreResults.runId))
      .where(and(eq(runs.experimentId, experimentId), eq(scoreResults.status, 'error')))
      .all();
    return new Set(rows.map((r) => r.runId));
  }

  /** Status counts and spend for many experiments in one query. */
  aggregates(
    experimentIds: string[],
  ): Map<string, { progress: ExperimentProgress; costUsd: number }> {
    const result = new Map<string, { progress: ExperimentProgress; costUsd: number }>();
    if (experimentIds.length === 0) return result;
    const rows = this.db
      .select({
        experimentId: runs.experimentId,
        status: runs.status,
        count: sql<number>`COUNT(*)`,
        cost: sql<number>`COALESCE(SUM(${runs.costUsd}), 0)`,
      })
      .from(runs)
      .where(inArray(runs.experimentId, experimentIds))
      .groupBy(runs.experimentId, runs.status)
      .all();
    for (const id of experimentIds) result.set(id, { progress: { ...EMPTY_PROGRESS }, costUsd: 0 });
    for (const row of rows) {
      const entry = result.get(row.experimentId)!;
      entry.progress[row.status as RunStatus] += row.count;
      entry.progress.total += row.count;
      entry.costUsd += row.cost;
    }
    return result;
  }
}
