import type {
  ScorerOf,
  ScorerType,
  ScoreTarget,
  TaskDefinition,
  TrajectoryEvent,
} from '@agent-evals/shared';

export interface ScoreContext {
  task: TaskDefinition;
  /** The agent's final answer with harness annotations removed. */
  finalAnswer: string;
  events: TrajectoryEvent[];
  workspaceDir: string;
  signal: AbortSignal;
  /** Text of the final answer or of a workspace file; `null` if the file does not exist. */
  readTarget(target: ScoreTarget): Promise<string | null>;
  /** Copies a grader-only fixture directory into the workspace. */
  addHiddenFixtures(relativeDir: string): Promise<void>;
}

export interface ScorerOutcome {
  /** 0–1. Binary checks return 0 or 1; some scorers grant partial credit. */
  score: number;
  passed: boolean;
  /** One sentence a human can read to understand the verdict. */
  reason: string;
  evidence?: Record<string, unknown>;
}

/**
 * Strategy for one scorer type. Implementations are stateless Nest providers
 * registered under the `SCORERS` multi-token.
 */
export interface Scorer<T extends ScorerType = ScorerType> {
  readonly type: T;
  score(definition: ScorerOf<T>, context: ScoreContext): Promise<ScorerOutcome>;
}

export const SCORERS = Symbol('SCORERS');

export function describeTarget(target: ScoreTarget): string {
  return target === 'final_answer' ? 'final answer' : `file ${target.slice('file:'.length)}`;
}

export function truncate(text: string, max = 300): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
