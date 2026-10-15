/**
 * HTTP contract between the API and the web app. Response payloads are plain
 * JSON; timestamps are ISO-8601 strings.
 */
import type { AgentConfigDefinition } from './schemas/agent-config';
import type { ScorerType, SuiteDefinition, TaskDefinition } from './schemas/task';

export type DefinitionSource = 'file' | 'user';
export type ExperimentStatus = 'queued' | 'running' | 'completed' | 'cancelled';
export type RunStatus = 'queued' | 'running' | 'completed' | 'error' | 'cancelled';
export type RunOutcome = 'pass' | 'fail';
/**
 * Why a run did not produce a clean result. `timeout` and `max_turns` are agent
 * failures (they count against the config); `provider` and `harness` are
 * infrastructure errors (retried, then excluded from statistics).
 */
export type RunErrorKind = 'timeout' | 'max_turns' | 'provider' | 'harness' | 'cancelled';

// ─── Definitions ─────────────────────────────────────────────────────────────

export interface SuiteSummary {
  id: string;
  name: string;
  description: string | null;
  source: DefinitionSource;
  version: string;
  taskCount: number;
  tags: string[];
  updatedAt: string;
}

export interface SuiteDetail extends SuiteSummary {
  definition: SuiteDefinition;
}

export interface AgentConfigSummary {
  id: string;
  name: string;
  description: string | null;
  source: DefinitionSource;
  version: string;
  model: { provider: string; name: string };
  toolsets: string[];
  skills: string[];
  memoryEnabled: boolean;
  updatedAt: string;
}

export interface AgentConfigDetail extends AgentConfigSummary {
  definition: AgentConfigDefinition;
}

export interface CatalogToolset {
  id: string;
  description: string;
}

export interface CatalogSkill {
  id: string;
  name: string;
  description: string;
}

export interface Catalog {
  toolsets: CatalogToolset[];
  skills: CatalogSkill[];
  scorerTypes: ScorerType[];
  hermesVersion: string | null;
}

// ─── Experiments & runs ──────────────────────────────────────────────────────

export interface ExperimentProgress {
  total: number;
  queued: number;
  running: number;
  completed: number;
  error: number;
  cancelled: number;
}

export interface ExperimentConfigRef {
  id: string;
  name: string;
  version: string;
}

export interface ExperimentSummary {
  id: string;
  name: string;
  description: string | null;
  suite: { id: string; name: string; version: string };
  configs: ExperimentConfigRef[];
  baselineConfigId: string;
  status: ExperimentStatus;
  trials: number;
  taskCount: number;
  concurrency: number;
  seed: number;
  progress: ExperimentProgress;
  totalCostUsd: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ExperimentDetail extends ExperimentSummary {
  snapshot: ExperimentSnapshot;
}

/** Immutable copy of every definition an experiment ran with. */
export interface ExperimentSnapshot {
  suite: SuiteDefinition;
  suiteVersion: string;
  configs: AgentConfigDefinition[];
  configVersions: Record<string, string>;
}

export interface RunUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  apiCalls: number;
  /** Includes auxiliary calls Hermes made during the run (e.g. title generation). */
  costUsd: number | null;
  costSource: 'hermes' | 'pricing_table' | 'unknown';
}

export interface RunSummary {
  id: string;
  experimentId: string;
  taskId: string;
  configId: string;
  trial: number;
  attempt: number;
  status: RunStatus;
  outcome: RunOutcome | null;
  score: number | null;
  errorKind: RunErrorKind | null;
  errorMessage: string | null;
  durationMs: number | null;
  costUsd: number | null;
  totalTokens: number | null;
  toolCalls: number | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ScoreResult {
  scorerId: string;
  type: ScorerType;
  description: string | null;
  weight: number;
  required: boolean;
  score: number;
  passed: boolean;
  /** `error` means the scorer itself could not run (counts as a failed check). */
  status: 'ok' | 'error';
  reason: string;
  evidence: Record<string, unknown> | null;
}

interface TrajectoryEventBase {
  seq: number;
  /** Unix epoch milliseconds. */
  ts: number;
}

export type TrajectoryEvent =
  | (TrajectoryEventBase & { type: 'init'; model: string; sessionId: string })
  | (TrajectoryEventBase & { type: 'assistant_text'; text: string })
  | (TrajectoryEventBase & {
      type: 'tool_call';
      toolCallId: string;
      name: string;
      input: unknown;
    })
  | (TrajectoryEventBase & {
      type: 'tool_result';
      toolCallId: string;
      name: string;
      output: string;
      durationMs: number | null;
      isError: boolean;
    })
  | (TrajectoryEventBase & {
      type: 'result';
      exitCode: number;
      text: string;
      durationMs: number | null;
      error: string | null;
    });

export type TrajectoryEventType = TrajectoryEvent['type'];

export interface WorkspaceFile {
  path: string;
  size: number;
  /** True when the file existed in the fixtures and was changed by the agent. */
  modified: boolean;
  /** True when the agent created the file. */
  created: boolean;
}

export interface RunDetail extends RunSummary {
  task: TaskDefinition;
  config: AgentConfigDefinition;
  finalAnswer: string | null;
  exitCode: number | null;
  turnExitReason: string | null;
  sessionId: string | null;
  usage: RunUsage | null;
  scores: ScoreResult[];
  events: TrajectoryEvent[];
  files: WorkspaceFile[];
  logTail: string | null;
}

export interface WorkspaceFileContent {
  path: string;
  size: number;
  content: string;
  truncated: boolean;
  binary: boolean;
}

// ─── Analysis ────────────────────────────────────────────────────────────────

export interface Interval {
  low: number;
  high: number;
}

export interface EstimateWithInterval {
  value: number;
  ci: Interval;
}

export interface ConfigStats {
  configId: string;
  configName: string;
  /** Runs that finished with a score (infra errors excluded). */
  scoredRuns: number;
  errorRuns: number;
  /** Mean over tasks of the per-task pass rate. */
  passRate: EstimateWithInterval;
  meanScore: EstimateWithInterval;
  meanCostUsd: number | null;
  totalCostUsd: number;
  costPerPassUsd: number | null;
  meanDurationMs: number | null;
  p95DurationMs: number | null;
  meanTokens: number | null;
  meanToolCalls: number | null;
}

export interface MetricComparison {
  baseline: number;
  candidate: number;
  /** candidate − baseline. */
  delta: number;
  ci: Interval;
  pValue: number;
  /** Holm–Bonferroni adjusted across all comparisons in the report. */
  pValueAdjusted: number;
}

export type Verdict = 'better' | 'worse' | 'no_detectable_difference' | 'insufficient_data';

export interface PairwiseComparison {
  baselineConfigId: string;
  candidateConfigId: string;
  pairedTasks: number;
  passRate: MetricComparison;
  meanScore: MetricComparison;
  /** Tasks where the candidate's mean score is higher / lower / equal. */
  wins: number;
  losses: number;
  ties: number;
  /** Smallest pass-rate difference this design detects with 80% power (null if undefined). */
  minimumDetectableEffect: number | null;
  verdict: Verdict;
  summary: string;
  costDeltaUsd: number | null;
  durationDeltaMs: number | null;
}

export interface TaskCell {
  configId: string;
  runs: number;
  passes: number;
  errors: number;
  passRate: number | null;
  meanScore: number | null;
  meanCostUsd: number | null;
  meanDurationMs: number | null;
}

export interface TaskRow {
  taskId: string;
  taskName: string;
  tags: string[];
  cells: TaskCell[];
  /** Some config passed this task on some trials but not others. */
  flaky: boolean;
}

export interface ExperimentReport {
  experimentId: string;
  generatedAt: string;
  confidenceLevel: number;
  alpha: number;
  baselineConfigId: string;
  configs: ConfigStats[];
  comparisons: PairwiseComparison[];
  tasks: TaskRow[];
  /** Caveats the reader should know before trusting the numbers. */
  warnings: string[];
  method: string;
}

// ─── Live updates (Server-Sent Events) ───────────────────────────────────────

export type LiveEvent =
  | {
      type: 'experiment.updated';
      experimentId: string;
      status: ExperimentStatus;
      progress: ExperimentProgress;
    }
  | { type: 'run.updated'; experimentId: string; run: RunSummary }
  | { type: 'run.event'; experimentId: string; runId: string; event: TrajectoryEvent };

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
}
