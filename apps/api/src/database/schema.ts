import type {
  AgentConfigDefinition,
  DefinitionSource,
  ExperimentSnapshot,
  ExperimentStatus,
  RunErrorKind,
  RunOutcome,
  RunStatus,
  RunUsage,
  ScorerType,
  SuiteDefinition,
  TrajectoryEventType,
  WorkspaceFile,
} from '@agent-evals/shared';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Timestamps are ISO-8601 strings: lexicographically sortable, timezone-explicit,
 * and identical to what the API returns.
 */

export const suites = sqliteTable('suites', {
  id: text().primaryKey(),
  name: text().notNull(),
  description: text(),
  source: text().$type<DefinitionSource>().notNull(),
  /** Content hash of the canonical definition; changes whenever the definition changes. */
  version: text().notNull(),
  definition: text({ mode: 'json' }).$type<SuiteDefinition>().notNull(),
  createdAt: text().notNull(),
  updatedAt: text().notNull(),
});

export const agentConfigs = sqliteTable('agent_configs', {
  id: text().primaryKey(),
  name: text().notNull(),
  description: text(),
  source: text().$type<DefinitionSource>().notNull(),
  version: text().notNull(),
  definition: text({ mode: 'json' }).$type<AgentConfigDefinition>().notNull(),
  createdAt: text().notNull(),
  updatedAt: text().notNull(),
});

export const experiments = sqliteTable(
  'experiments',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    description: text(),
    suiteId: text().notNull(),
    baselineConfigId: text().notNull(),
    status: text().$type<ExperimentStatus>().notNull(),
    trials: integer().notNull(),
    concurrency: integer().notNull(),
    seed: integer().notNull(),
    /** Frozen copies of the suite and configs at launch — results stay interpretable after edits. */
    snapshot: text({ mode: 'json' }).$type<ExperimentSnapshot>().notNull(),
    createdAt: text().notNull(),
    startedAt: text(),
    finishedAt: text(),
  },
  (t) => [index('experiments_created_at_idx').on(t.createdAt)],
);

export const runs = sqliteTable(
  'runs',
  {
    id: text().primaryKey(),
    experimentId: text()
      .notNull()
      .references(() => experiments.id, { onDelete: 'cascade' }),
    taskId: text().notNull(),
    configId: text().notNull(),
    trial: integer().notNull(),
    /** Position in the (shuffled) execution order. */
    queueOrder: integer().notNull(),
    attempt: integer().notNull().default(1),
    status: text().$type<RunStatus>().notNull(),
    outcome: text().$type<RunOutcome>(),
    score: real(),
    errorKind: text().$type<RunErrorKind>(),
    errorMessage: text(),
    finalAnswer: text(),
    exitCode: integer(),
    turnExitReason: text(),
    sessionId: text(),
    usage: text({ mode: 'json' }).$type<RunUsage>(),
    costUsd: real(),
    totalTokens: integer(),
    toolCalls: integer(),
    durationMs: integer(),
    files: text({ mode: 'json' }).$type<WorkspaceFile[]>(),
    logTail: text(),
    startedAt: text(),
    finishedAt: text(),
    createdAt: text().notNull(),
  },
  (t) => [
    index('runs_experiment_idx').on(t.experimentId, t.status),
    index('runs_queue_idx').on(t.status, t.queueOrder),
    uniqueIndex('runs_cell_trial_uq').on(t.experimentId, t.taskId, t.configId, t.trial),
  ],
);

export const runEvents = sqliteTable(
  'run_events',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    runId: text()
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    seq: integer().notNull(),
    type: text().$type<TrajectoryEventType>().notNull(),
    ts: integer().notNull(),
    payload: text({ mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  },
  (t) => [uniqueIndex('run_events_run_seq_uq').on(t.runId, t.seq)],
);

export const scoreResults = sqliteTable(
  'score_results',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    runId: text()
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    scorerId: text().notNull(),
    type: text().$type<ScorerType>().notNull(),
    description: text(),
    weight: real().notNull(),
    required: integer({ mode: 'boolean' }).notNull(),
    score: real().notNull(),
    passed: integer({ mode: 'boolean' }).notNull(),
    status: text().$type<'ok' | 'error'>().notNull(),
    reason: text().notNull(),
    evidence: text({ mode: 'json' }).$type<Record<string, unknown>>(),
  },
  (t) => [index('score_results_run_idx').on(t.runId)],
);

export type SuiteRow = typeof suites.$inferSelect;
export type AgentConfigRow = typeof agentConfigs.$inferSelect;
export type ExperimentRow = typeof experiments.$inferSelect;
export type RunRow = typeof runs.$inferSelect;
export type RunEventRow = typeof runEvents.$inferSelect;
export type ScoreResultRow = typeof scoreResults.$inferSelect;
