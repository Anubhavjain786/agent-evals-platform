import { z } from 'zod';
import { RelativePathSchema, SlugSchema } from './common';

/**
 * What a text-based scorer inspects: the agent's final answer, or a file the
 * agent was expected to produce inside its workspace (`file:<relative path>`).
 */
export const ScoreTargetSchema = z.union([
  z.literal('final_answer'),
  z.templateLiteral(['file:', z.string().min(1)]),
]);
export type ScoreTarget = z.infer<typeof ScoreTargetSchema>;

const scorerBase = {
  /** Unique within the task; defaults to `<type>-<index>`. */
  id: SlugSchema.optional(),
  description: z.string().max(500).optional(),
  /** Relative weight in the task score (weighted mean of scorer scores). */
  weight: z.number().positive().max(100).default(1),
  /** A required scorer must pass for the task to pass, regardless of the score. */
  required: z.boolean().default(false),
};

export const ContainsScorerSchema = z.object({
  ...scorerBase,
  type: z.literal('contains'),
  target: ScoreTargetSchema.default('final_answer'),
  values: z.array(z.string().min(1)).min(1),
  mode: z.enum(['all', 'any']).default('all'),
  caseSensitive: z.boolean().default(false),
  /** Invert the check: pass when none of the values appear. */
  negate: z.boolean().default(false),
});

export const ExactMatchScorerSchema = z.object({
  ...scorerBase,
  type: z.literal('exact_match'),
  target: ScoreTargetSchema.default('final_answer'),
  expected: z.string(),
  caseSensitive: z.boolean().default(false),
});

export const RegexScorerSchema = z.object({
  ...scorerBase,
  type: z.literal('regex'),
  target: ScoreTargetSchema.default('final_answer'),
  pattern: z.string().min(1),
  flags: z
    .string()
    .regex(/^[gimsuy]*$/)
    .default(''),
});

export const NumericScorerSchema = z.object({
  ...scorerBase,
  type: z.literal('numeric'),
  target: ScoreTargetSchema.default('final_answer'),
  expected: z.number(),
  /** Absolute tolerance. */
  tolerance: z.number().nonnegative().default(0),
  /** Which number to use when the text contains several. */
  pick: z.enum(['last', 'first']).default('last'),
});

export const JsonFieldScorerSchema = z.object({
  ...scorerBase,
  type: z.literal('json_field'),
  target: ScoreTargetSchema,
  /** Dot path into the parsed JSON, e.g. `totals.north` or `items.0.id`. Empty = whole document. */
  path: z.string().default(''),
  expected: z.unknown(),
  /** Absolute tolerance applied when both values are numbers. */
  tolerance: z.number().nonnegative().default(0),
});

export const FileExistsScorerSchema = z.object({
  ...scorerBase,
  type: z.literal('file_exists'),
  path: RelativePathSchema,
  shouldExist: z.boolean().default(true),
});

export const CommandScorerSchema = z.object({
  ...scorerBase,
  type: z.literal('command'),
  /** Shell command executed in the run workspace after the agent finishes. */
  run: z.string().min(1),
  expectExitCode: z.number().int().default(0),
  timeoutSec: z.number().int().positive().max(600).default(60),
  /**
   * Fixture directory (relative to `evals/fixtures`) copied into the workspace
   * only after the agent finished — e.g. hidden tests the agent must not see.
   */
  hiddenFixtures: RelativePathSchema.optional(),
});

export const ToolUsageScorerSchema = z.object({
  ...scorerBase,
  type: z.literal('tool_usage'),
  /** Hermes tool name, e.g. `terminal`, `write_file`, `memory`, `skill_view`. */
  tool: z.string().min(1),
  min: z.number().int().nonnegative().optional(),
  max: z.number().int().nonnegative().optional(),
});

export const LlmJudgeScorerSchema = z.object({
  ...scorerBase,
  type: z.literal('llm_judge'),
  target: ScoreTargetSchema.default('final_answer'),
  /** Grading instructions. The judge returns a 0–10 score with a rationale. */
  rubric: z.string().min(1),
  /** Normalised score (0–1) at or above which the scorer passes. */
  passThreshold: z.number().min(0).max(1).default(0.7),
});

export const ScorerSchema = z.discriminatedUnion('type', [
  ContainsScorerSchema,
  ExactMatchScorerSchema,
  RegexScorerSchema,
  NumericScorerSchema,
  JsonFieldScorerSchema,
  FileExistsScorerSchema,
  CommandScorerSchema,
  ToolUsageScorerSchema,
  LlmJudgeScorerSchema,
]);
export type ScorerDefinition = z.infer<typeof ScorerSchema>;
export type ScorerType = ScorerDefinition['type'];
export type ScorerOf<T extends ScorerType> = Extract<ScorerDefinition, { type: T }>;

export const SCORER_TYPES = ScorerSchema.options.map((o) => o.shape.type.value) as ScorerType[];

export const TaskSchema = z
  .object({
    id: SlugSchema,
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    /** Which agent capability the task exercises; used for filtering and reporting. */
    tags: z.array(z.string().min(1).max(40)).default([]),
    /** The user message sent to the agent. */
    prompt: z.string().min(1).max(20_000),
    /** Fixture directory (relative to `evals/fixtures`) copied into the workspace before the run. */
    fixtures: RelativePathSchema.optional(),
    /** Inline files written into the workspace before the run (path → content). */
    files: z.record(RelativePathSchema, z.string()).default({}),
    scoring: z.object({
      scorers: z.array(ScorerSchema).min(1),
      /**
       * By default a task passes only when every scorer passes. Set a threshold
       * to grant partial credit: the task passes when the weighted score reaches
       * it (required scorers must still pass).
       */
      passThreshold: z.number().min(0).max(1).optional(),
    }),
    limits: z
      .object({
        timeoutSec: z.number().int().positive().max(3600).default(300),
        /** Overrides the agent config's max tool-calling iterations for this task. */
        maxTurns: z.number().int().positive().max(200).optional(),
      })
      .default({ timeoutSec: 300 }),
  })
  .superRefine((task, ctx) => {
    const seen = new Set<string>();
    task.scoring.scorers.forEach((scorer, index) => {
      const id = scorer.id ?? `${scorer.type}-${index + 1}`;
      if (seen.has(id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['scoring', 'scorers', index, 'id'],
          message: `duplicate scorer id "${id}"`,
        });
      }
      seen.add(id);
    });
  });
export type TaskDefinition = z.infer<typeof TaskSchema>;
export type TaskDefinitionInput = z.input<typeof TaskSchema>;

export const SuiteSchema = z
  .object({
    id: SlugSchema,
    name: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    tasks: z.array(TaskSchema).min(1).max(500),
  })
  .superRefine((suite, ctx) => {
    const seen = new Set<string>();
    suite.tasks.forEach((task, index) => {
      if (seen.has(task.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['tasks', index, 'id'],
          message: `duplicate task id "${task.id}"`,
        });
      }
      seen.add(task.id);
    });
  });
export type SuiteDefinition = z.infer<typeof SuiteSchema>;
export type SuiteDefinitionInput = z.input<typeof SuiteSchema>;

/** Resolves the effective id of a scorer (explicit id, or `<type>-<1-based index>`). */
export function scorerId(scorer: ScorerDefinition, index: number): string {
  return scorer.id ?? `${scorer.type}-${index + 1}`;
}
