import type {
  AgentConfigDefinition,
  RunUsage,
  TaskDefinition,
  TrajectoryEvent,
} from '@agent-evals/shared';

/** Filesystem layout of one run. Everything lives under `root` and is removed with it. */
export interface RunDirectories {
  root: string;
  /** Isolated Hermes home: config, memory, skills, sessions. Never shared between runs. */
  home: string;
  /** The agent's working directory, seeded with the task fixtures. */
  workspace: string;
  /** Per-run runtime dir for Hermes' sockets and locks. */
  runtime: string;
}

/** A trajectory event before the executor assigns its sequence number. */
export type RunnerEvent = TrajectoryEvent extends infer E
  ? E extends TrajectoryEvent
    ? Omit<E, 'seq'>
    : never
  : never;

export interface AgentRunRequest {
  runId: string;
  task: TaskDefinition;
  config: AgentConfigDefinition;
  dirs: RunDirectories;
  maxTurns: number;
  timeoutMs: number;
  signal: AbortSignal;
  onEvent: (event: RunnerEvent) => void;
}

/**
 * - `completed`: the agent finished its turn.
 * - `failed`: the agent stopped without completing (Hermes reported failure/partial).
 * - `max_turns` / `timeout`: the agent exhausted its budget — an agent failure.
 * - `infra_error`: provider or harness problem — not the agent's fault; retried.
 * - `cancelled`: the experiment was cancelled.
 */
export type AgentRunStatus =
  'completed' | 'failed' | 'max_turns' | 'timeout' | 'infra_error' | 'cancelled';

export interface AgentRunResult {
  status: AgentRunStatus;
  finalAnswer: string;
  exitCode: number | null;
  errorMessage: string | null;
  turnExitReason: string | null;
  sessionId: string | null;
  usage: RunUsage;
  durationMs: number;
  /** Last lines of the harness' stderr, for diagnosing infra errors. */
  logTail: string;
}

/** Strategy interface: the platform is agent-agnostic; Hermes is one implementation. */
export interface AgentRunner {
  run(request: AgentRunRequest): Promise<AgentRunResult>;
}

export const AGENT_RUNNER = Symbol('AGENT_RUNNER');
