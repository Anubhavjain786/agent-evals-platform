import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentConfigDefinition } from '@agent-evals/shared';
import { stringify as toYaml } from 'yaml';

/** Memory entries are stored `§`-separated in Hermes' MEMORY.md / USER.md. */
const MEMORY_DELIMITER = '\n§\n';

type ConfigTree = Record<string, unknown>;

const isPlainObject = (value: unknown): value is ConfigTree =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function deepMerge(base: ConfigTree, override: ConfigTree): ConfigTree {
  const merged: ConfigTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] =
      isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return merged;
}

/**
 * Resolves `${VAR}` / `${VAR:-default}` placeholders, so one definition works
 * both in Docker (host.docker.internal) and on a developer machine (localhost).
 */
export function expandEnv(value: string, env: NodeJS.ProcessEnv): string {
  return value.replace(
    /\$\{([A-Z_][A-Z0-9_]*)(?::-([^}]*))?\}/g,
    (_match, name: string, fallback?: string) => env[name] || fallback || '',
  );
}

/**
 * Translates an agent config into the Hermes `config.yaml` for one run.
 * Everything not under test is pinned so that runs differ only in the
 * variables the config declares.
 */
export function buildHermesConfig(
  config: AgentConfigDefinition,
  options: { maxTurns: number; runBudgetSec: number; env: NodeJS.ProcessEnv },
): ConfigTree {
  const { model, memory } = config;
  const modelSection: ConfigTree = { provider: model.provider, default: model.name };
  if (model.baseUrl) modelSection.base_url = expandEnv(model.baseUrl, options.env);
  if (model.contextLength) modelSection.context_length = model.contextLength;
  // Only the variable *name* is written; Hermes resolves it from the process env.
  if (model.apiKeyEnv && model.provider === 'custom')
    modelSection.api_key = `\${${model.apiKeyEnv}}`;

  // The run budget gives the agent a wrap-up notice at 80% before the hard kill.
  const agentSection: ConfigTree = {
    max_turns: options.maxTurns,
    run_budget_seconds: options.runBudgetSec,
  };
  if (model.reasoningEffort) agentSection.reasoning_effort = model.reasoningEffort;

  const generated: ConfigTree = {
    model: modelSection,
    agent: agentSection,
    memory: { memory_enabled: memory.enabled, user_profile_enabled: memory.enabled },
    // Post-turn learning forks and title generation add cost and nondeterminism
    // that is not part of what a single-task eval measures.
    auxiliary: {
      background_review: { enabled: false },
      title_generation: { enabled: false },
    },
    terminal: { cwd: '.' },
    // `chat` auto-starts a gateway daemon; let it exit promptly once the run is over.
    gateway: { unmanaged_idle_exit_seconds: 15 },
  };

  return config.hermesConfig ? deepMerge(generated, config.hermesConfig) : generated;
}

/**
 * Materialises an isolated Hermes home for one run: config, persona, seeded
 * memory and exactly the skills the config opts into.
 */
export async function materializeHermesHome(input: {
  home: string;
  config: AgentConfigDefinition;
  maxTurns: number;
  runBudgetSec: number;
  env: NodeJS.ProcessEnv;
  skillDir: (id: string) => string;
}): Promise<void> {
  const { home, config } = input;
  await mkdir(join(home, 'memories'), { recursive: true, mode: 0o700 });
  await mkdir(join(home, 'skills'), { recursive: true, mode: 0o700 });

  const hermesConfig = buildHermesConfig(config, {
    maxTurns: input.maxTurns,
    runBudgetSec: input.runBudgetSec,
    env: input.env,
  });
  await writeFile(join(home, 'config.yaml'), toYaml(hermesConfig), { mode: 0o600 });

  if (!config.skills.bundled) await writeFile(join(home, '.no-bundled-skills'), '');
  for (const id of config.skills.include) {
    await cp(input.skillDir(id), join(home, 'skills', id), { recursive: true });
  }

  if (config.persona) await writeFile(join(home, 'SOUL.md'), config.persona);

  if (config.memory.enabled) {
    if (config.memory.notes.length > 0) {
      await writeFile(
        join(home, 'memories', 'MEMORY.md'),
        config.memory.notes.join(MEMORY_DELIMITER),
      );
    }
    if (config.memory.userProfile.length > 0) {
      await writeFile(
        join(home, 'memories', 'USER.md'),
        config.memory.userProfile.join(MEMORY_DELIMITER),
      );
    }
  }
}

/** CLI arguments for one unattended, single-task Hermes run. */
export function buildHermesArgs(input: {
  config: AgentConfigDefinition;
  promptFile: string;
  usageFile: string;
  maxTurns: number;
}): string[] {
  const { config } = input;
  const args = [
    '--usage-file',
    input.usageFile,
    'chat',
    '--oneshot',
    '--query-file',
    input.promptFile,
    '--format',
    'stream-json',
    '--source',
    'tool',
    // No human is present to approve commands; the run directory is the sandbox.
    '--yolo',
    '--max-turns',
    String(input.maxTurns),
  ];
  if (config.toolsets.length > 0) args.push('--toolsets', config.toolsets.join(','));
  if (config.skills.preload.length > 0) args.push('--skills', config.skills.preload.join(','));
  return args;
}
