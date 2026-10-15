import { z } from 'zod';
import { SlugSchema } from './common';

export const CreateExperimentSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(4000).optional(),
    suiteId: SlugSchema,
    /** Configurations to compare. The first one is the baseline unless `baselineConfigId` is set. */
    configIds: z.array(SlugSchema).min(1).max(8),
    baselineConfigId: SlugSchema.optional(),
    /** Repetitions of every (task, config) pair. Agents are stochastic; more trials = tighter intervals. */
    trials: z.number().int().min(1).max(20).default(3),
    /** Restrict the experiment to a subset of the suite's tasks. */
    taskIds: z.array(SlugSchema).min(1).optional(),
    /** Maximum runs of this experiment executing at the same time. */
    concurrency: z.number().int().min(1).max(32).default(4),
    /** Seed for run-order shuffling and bootstrap resampling (reproducible analysis). */
    seed: z
      .number()
      .int()
      .min(0)
      .max(2 ** 31 - 1)
      .optional(),
  })
  .superRefine((input, ctx) => {
    if (new Set(input.configIds).size !== input.configIds.length) {
      ctx.addIssue({ code: 'custom', path: ['configIds'], message: 'configIds must be unique' });
    }
    if (input.baselineConfigId && !input.configIds.includes(input.baselineConfigId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['baselineConfigId'],
        message: 'baselineConfigId must be one of configIds',
      });
    }
  });
export type CreateExperimentInput = z.input<typeof CreateExperimentSchema>;
export type CreateExperimentCommand = z.output<typeof CreateExperimentSchema>;

export const RunListQuerySchema = z.object({
  configId: SlugSchema.optional(),
  taskId: SlugSchema.optional(),
  status: z.enum(['queued', 'running', 'completed', 'error', 'cancelled']).optional(),
  outcome: z.enum(['pass', 'fail']).optional(),
});
export type RunListQuery = z.infer<typeof RunListQuerySchema>;
