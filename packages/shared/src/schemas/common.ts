import { z } from 'zod';

/** Stable, URL-safe identifier used for suites, tasks and agent configs. */
export const SlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'must be lowercase letters, digits, ".", "_" or "-"');

/** Workspace-relative path. Absolute paths and parent traversal are rejected. */
export const RelativePathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((p) => !p.startsWith('/') && !p.split(/[\\/]/).includes('..'), {
    message: 'must be a relative path inside the workspace',
  });
