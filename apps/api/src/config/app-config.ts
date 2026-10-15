import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';

const booleanFromEnv = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

/** Raw environment contract. Every variable is optional and documented in `.env.example`. */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATA_DIR: z.string().optional(),
  DATABASE_PATH: z.string().optional(),
  EVALS_DIR: z.string().optional(),
  WEB_DIST_DIR: z.string().optional(),
  HERMES_BIN: z.string().default('hermes'),
  MAX_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(4),
  RUN_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  RUN_RETRY_DELAY_MS: z.coerce.number().int().min(0).max(600_000).default(5_000),
  KEEP_RUN_HOME: booleanFromEnv.default(false),
  JUDGE_BASE_URL: z.string().url().optional(),
  JUDGE_MODEL: z.string().optional(),
  JUDGE_API_KEY: z.string().optional(),
  JUDGE_TIMEOUT_SEC: z.coerce.number().int().min(5).max(600).default(120),
});

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  host: string;
  port: number;
  logLevel: string;
  /** Root for the SQLite database and per-run directories. */
  dataDir: string;
  databasePath: string;
  /** Root of the definitions-as-code tree (suites, configs, skills, fixtures). */
  evalsDir: string;
  /** Built SPA to serve, if present. */
  webDistDir: string | null;
  hermesBin: string;
  maxConcurrency: number;
  runMaxAttempts: number;
  /** Base of the exponential backoff before retrying a run that hit an infrastructure error. */
  retryBaseDelayMs: number;
  keepRunHome: boolean;
  judge: {
    baseUrl: string | null;
    model: string | null;
    apiKey: string | null;
    timeoutMs: number;
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');

/** Walks up from `start` until `relative` exists; used to locate the repo root in dev and in Docker. */
function findUp(start: string, relative: string): string | null {
  let current = start;
  for (;;) {
    const candidate = join(current, relative);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function absolute(path: string): string {
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}

const IN_MEMORY = ':memory:';

export function loadAppConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const env = parsed.data;

  const evalsDir = env.EVALS_DIR
    ? absolute(env.EVALS_DIR)
    : (findUp(__dirname, 'evals') ?? absolute('evals'));
  const repoRoot = dirname(evalsDir);
  const dataDir = env.DATA_DIR ? absolute(env.DATA_DIR) : join(repoRoot, 'data');
  const webDist = env.WEB_DIST_DIR
    ? absolute(env.WEB_DIST_DIR)
    : join(repoRoot, 'apps', 'web', 'dist');

  return {
    env: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    dataDir,
    databasePath:
      env.DATABASE_PATH === IN_MEMORY
        ? IN_MEMORY
        : env.DATABASE_PATH
          ? absolute(env.DATABASE_PATH)
          : join(dataDir, 'agent-evals.db'),
    evalsDir,
    webDistDir: existsSync(join(webDist, 'index.html')) ? webDist : null,
    hermesBin: env.HERMES_BIN,
    maxConcurrency: env.MAX_CONCURRENCY,
    runMaxAttempts: env.RUN_MAX_ATTEMPTS,
    retryBaseDelayMs: env.RUN_RETRY_DELAY_MS,
    keepRunHome: env.KEEP_RUN_HOME,
    judge: {
      baseUrl: env.JUDGE_BASE_URL ?? null,
      model: env.JUDGE_MODEL ?? null,
      apiKey: env.JUDGE_API_KEY ?? null,
      timeoutMs: env.JUDGE_TIMEOUT_SEC * 1000,
    },
  };
}
