import { z } from 'zod';
import { SlugSchema } from './common';

export const ReasoningEffortSchema = z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);

export const ModelPricingSchema = z.object({
  /** USD per million input tokens (uncached). */
  inputPerMTok: z.number().nonnegative(),
  /** USD per million output tokens. */
  outputPerMTok: z.number().nonnegative(),
  /** USD per million cached input tokens; defaults to the input price. */
  cachedInputPerMTok: z.number().nonnegative().optional(),
});
export type ModelPricing = z.infer<typeof ModelPricingSchema>;

export const ModelSettingsSchema = z.object({
  /** Hermes provider id: `custom` (any OpenAI-compatible endpoint), `openrouter`, `anthropic`, ... */
  provider: z.string().min(1).max(64),
  /** Model identifier as the provider expects it, e.g. `gpt-oss:120b-cloud`. */
  name: z.string().min(1).max(200),
  /** Endpoint for `custom` providers. Supports `${ENV_VAR}` placeholders resolved at run time. */
  baseUrl: z.string().min(1).max(500).optional(),
  /**
   * Name of the environment variable holding the API key. Secrets never live in
   * a config definition; only the variable name does.
   */
  apiKeyEnv: z
    .string()
    .regex(/^[A-Z_][A-Z0-9_]*$/)
    .optional(),
  /** Context window hint for endpoints that do not report one (Hermes requires ≥ 64k). */
  contextLength: z.number().int().min(8_000).max(10_000_000).optional(),
  reasoningEffort: ReasoningEffortSchema.optional(),
  /**
   * List prices used to estimate spend when Hermes cannot price the model itself
   * (custom endpoints). Lets subscription/local models report an equivalent cost.
   */
  pricing: ModelPricingSchema.optional(),
});
export type ModelSettings = z.infer<typeof ModelSettingsSchema>;

export const AgentConfigSchema = z
  .object({
    id: SlugSchema,
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    model: ModelSettingsSchema,
    /** Hermes toolsets enabled for the run, e.g. `file`, `terminal`, `skills`, `memory`, `web`. */
    toolsets: z.array(z.string().min(1).max(64)).default(['file', 'terminal']),
    skills: z
      .object({
        /** Seed Hermes' bundled skill catalog into the run's home. */
        bundled: z.boolean().default(false),
        /** Skills from `evals/skills` installed into the run's home. */
        include: z.array(SlugSchema).default([]),
        /** Skills preloaded into the system prompt (`hermes chat --skills`). Must be installed. */
        preload: z.array(SlugSchema).default([]),
      })
      .default({ bundled: false, include: [], preload: [] }),
    memory: z
      .object({
        /** Enables Hermes' built-in persistent memory (MEMORY.md / USER.md + the memory tool). */
        enabled: z.boolean().default(false),
        /** Entries seeded into MEMORY.md, simulating knowledge from earlier sessions. */
        notes: z.array(z.string().min(1).max(2000)).default([]),
        /** Entries seeded into USER.md (the user profile store). */
        userProfile: z.array(z.string().min(1).max(1375)).default([]),
      })
      .default({ enabled: false, notes: [], userProfile: [] }),
    /** Persona written to SOUL.md in the run's Hermes home. */
    persona: z.string().max(10_000).optional(),
    /** Default maximum tool-calling iterations per run (tasks may override). */
    maxTurns: z.number().int().positive().max(200).default(20),
    /**
     * Escape hatch: extra keys deep-merged into the generated Hermes `config.yaml`
     * (e.g. `compression`, `terminal.timeout`). Applied last.
     */
    hermesConfig: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((config, ctx) => {
    if (config.skills.bundled) return;
    config.skills.preload.forEach((name, index) => {
      if (!config.skills.include.includes(name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['skills', 'preload', index],
          message: `preloaded skill "${name}" must also be listed in skills.include`,
        });
      }
    });
  });
export type AgentConfigDefinition = z.infer<typeof AgentConfigSchema>;
export type AgentConfigDefinitionInput = z.input<typeof AgentConfigSchema>;
