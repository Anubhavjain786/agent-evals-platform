import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type AgentConfigDefinition, AgentConfigSchema } from '@agent-evals/shared';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import type { RunnerEvent } from '../agent-runner';
import { cleanFinalAnswer } from './final-answer';
import {
  buildHermesArgs,
  buildHermesConfig,
  deepMerge,
  expandEnv,
  materializeHermesHome,
} from './hermes-home';
import { HermesStreamParser } from './stream-parser';
import { classifyOutcome, isInfraError, priceTokens, toRunUsage } from './usage';

// Captured from `hermes chat --oneshot --format stream-json` (Hermes v0.22.1).
const STREAM = [
  '{"type": "system", "subtype": "init", "model": "", "session_id": "", "timestamp": 1792044683444}',
  '{"type": "tool_use", "name": "write_file", "tool_call_id": "call_1", "input": {"path": "hello.py", "content": "print(5050)"}, "timestamp": 1792044696739}',
  '{"type": "tool_result", "name": "write_file", "tool_call_id": "call_1", "output": "{\\"bytes_written\\": 12}", "duration_ms": 228, "is_error": false, "timestamp": 1792044698097}',
  '{"type": "text", "text": "\\n\\n50", "timestamp": 1792044699592}',
  '{"type": "text", "text": "50", "timestamp": 1792044699593}',
  '{"type": "result", "session_id": "local-abc", "exit_code": 0, "text": "5050", "tokens": {"input": 17799, "output": 273, "total": 18072, "cache_read": 13424, "cache_write": 0}, "duration_ms": 15000, "timestamp": 1792044699600}',
].join('\n');

function config(overrides: Partial<AgentConfigDefinition> = {}): AgentConfigDefinition {
  return AgentConfigSchema.parse({
    id: 'cfg',
    name: 'Config',
    model: {
      provider: 'custom',
      name: 'gpt-oss:120b-cloud',
      baseUrl: '${OLLAMA_BASE_URL:-http://localhost:11434/v1}',
    },
    ...overrides,
  });
}

describe('HermesStreamParser', () => {
  it('normalises events, coalesces text deltas and captures the result record', () => {
    const events: RunnerEvent[] = [];
    const parser = new HermesStreamParser((e) => events.push(e));
    // Feed in awkward chunks to exercise line buffering.
    for (let i = 0; i < STREAM.length; i += 37) parser.push(STREAM.slice(i, i + 37));
    parser.end();

    expect(events.map((e) => e.type)).toEqual([
      'init',
      'tool_call',
      'tool_result',
      'assistant_text',
      'result',
    ]);
    expect(events[1]).toMatchObject({
      name: 'write_file',
      toolCallId: 'call_1',
      input: { path: 'hello.py' },
    });
    expect(events[2]).toMatchObject({ durationMs: 228, isError: false });
    expect(events[3]).toMatchObject({ text: '\n\n5050' });
    expect(parser.result).toMatchObject({
      exitCode: 0,
      text: '5050',
      sessionId: 'local-abc',
      tokens: { input: 17799, cacheRead: 13424 },
    });
    expect(parser.malformed).toBe(0);
  });

  it('counts malformed lines and ignores unknown event types', () => {
    const events: RunnerEvent[] = [];
    const parser = new HermesStreamParser((e) => events.push(e));
    parser.push('not json\n{"type":"future_event","x":1}\n');
    parser.end();
    expect(events).toEqual([]);
    expect(parser.malformed).toBe(1);
  });
});

describe('classifyOutcome', () => {
  const result = (exitCode: number, error: string | null = null) => ({
    sessionId: 's',
    exitCode,
    text: '',
    durationMs: 1,
    error,
    tokens: { input: 0, output: 0, total: 0, cacheRead: 0 },
  });
  const base = { report: null, timedOut: false, cancelled: false };

  it('maps Hermes outcomes to run statuses', () => {
    expect(classifyOutcome({ ...base, result: result(0) }).status).toBe('completed');
    expect(classifyOutcome({ ...base, result: result(1, 'model gave up') }).status).toBe('failed');
    expect(classifyOutcome({ ...base, result: null }).status).toBe('infra_error');
    expect(classifyOutcome({ ...base, result: result(0), timedOut: true }).status).toBe('timeout');
    expect(classifyOutcome({ ...base, result: result(0), cancelled: true }).status).toBe(
      'cancelled',
    );
    expect(
      classifyOutcome({
        ...base,
        result: result(1),
        report: { turn_exit_reason: 'max_iterations_reached(20/20)' },
      }).status,
    ).toBe('max_turns');
  });

  it('treats provider throttling, quota and outages as infrastructure errors', () => {
    expect(
      classifyOutcome({
        ...base,
        result: result(1, 'HTTP 402: This model is not in the Free plan'),
      }).status,
    ).toBe('infra_error');
    expect(isInfraError('HTTP 429 Too Many Requests')).toBe(true);
    expect(isInfraError('Gateway could not start: refusing to run as root')).toBe(true);
    expect(isInfraError('HTTP 503 service unavailable')).toBe(true);
    expect(isInfraError('The answer is 42')).toBe(false);
    expect(isInfraError(null)).toBe(false);
  });
});

describe('usage and cost', () => {
  const pricing = { inputPerMTok: 1, outputPerMTok: 2, cachedInputPerMTok: 0.1 };

  it('prices cached input separately', () => {
    expect(
      priceTokens(pricing, { input: 1_000_000, output: 500_000, cacheRead: 400_000 }),
    ).toBeCloseTo(0.6 + 0.04 + 1);
  });

  it('prefers Hermes pricing, falls back to the pricing table, else reports unknown', () => {
    const priced = toRunUsage(
      {
        cost_status: 'estimated',
        total_including_auxiliary: { estimated_cost_usd: 0.12, total_tokens: 10, api_calls: 2 },
        input_tokens: 5,
        output_tokens: 5,
      },
      null,
      pricing,
    );
    expect(priced).toMatchObject({ costUsd: 0.12, costSource: 'hermes', apiCalls: 2 });

    const tabled = toRunUsage(
      {
        cost_status: 'unknown',
        estimated_cost_usd: 0,
        input_tokens: 1_000_000,
        output_tokens: 0,
        cache_read_tokens: 0,
        auxiliary: { input_tokens: 1_000_000, output_tokens: 0 },
      },
      null,
      pricing,
    );
    expect(tabled).toMatchObject({ costUsd: 2, costSource: 'pricing_table' });

    expect(toRunUsage(null, null, undefined)).toMatchObject({
      costUsd: null,
      costSource: 'unknown',
      totalTokens: 0,
    });
  });
});

describe('Hermes home and arguments', () => {
  it('expands ${VAR} and ${VAR:-default} placeholders', () => {
    expect(expandEnv('${A}/x', { A: 'a' })).toBe('a/x');
    expect(expandEnv('${B:-http://localhost}', {})).toBe('http://localhost');
    expect(expandEnv('${B:-http://localhost}', { B: 'http://host.docker.internal' })).toBe(
      'http://host.docker.internal',
    );
  });

  it('deep-merges overrides without mutating the base', () => {
    const base = { a: { b: 1, c: 2 }, d: [1] };
    expect(deepMerge(base, { a: { c: 3 }, d: [2] })).toEqual({ a: { b: 1, c: 3 }, d: [2] });
    expect(base.a.c).toBe(2);
  });

  it('pins everything not under test and references the API key by name only', () => {
    const generated = buildHermesConfig(
      config({
        model: {
          provider: 'custom',
          name: 'm',
          baseUrl: '${OLLAMA_BASE_URL:-http://localhost:11434/v1}',
          apiKeyEnv: 'MY_KEY',
        },
        hermesConfig: { terminal: { timeout: 60 } },
      }),
      { maxTurns: 7, env: {} },
    );
    expect(generated).toMatchObject({
      model: {
        provider: 'custom',
        default: 'm',
        base_url: 'http://localhost:11434/v1',
        api_key: '${MY_KEY}',
      },
      agent: { max_turns: 7 },
      memory: { memory_enabled: false, user_profile_enabled: false },
      auxiliary: { background_review: { enabled: false }, title_generation: { enabled: false } },
      terminal: { cwd: '.', timeout: 60 },
    });
  });

  it('materialises config, memory and only the opted-in skills', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hermes-home-'));
    const skills = join(root, 'library');
    await mkdir(join(skills, 'alpha'), { recursive: true });
    await writeFile(join(skills, 'alpha', 'SKILL.md'), '---\nname: alpha\n---\n');
    const home = join(root, 'home');

    await materializeHermesHome({
      home,
      config: config({
        skills: { bundled: false, include: ['alpha'], preload: [] },
        memory: { enabled: true, notes: ['fact one', 'fact two'], userProfile: ['likes tea'] },
        persona: 'You are terse.',
      }),
      maxTurns: 5,
      env: {},
      skillDir: (id) => join(skills, id),
    });

    const yaml = parseYaml(await readFile(join(home, 'config.yaml'), 'utf8')) as {
      memory: { memory_enabled: boolean };
    };
    expect(yaml.memory.memory_enabled).toBe(true);
    expect(await readFile(join(home, 'memories', 'MEMORY.md'), 'utf8')).toBe(
      'fact one\n§\nfact two',
    );
    expect(await readFile(join(home, 'memories', 'USER.md'), 'utf8')).toBe('likes tea');
    expect(await readFile(join(home, 'SOUL.md'), 'utf8')).toBe('You are terse.');
    expect(existsSync(join(home, 'skills', 'alpha', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(home, '.no-bundled-skills'))).toBe(true);
  });

  it('builds a one-shot, stream-json invocation with the config toolsets and skills', () => {
    const args = buildHermesArgs({
      config: config({
        toolsets: ['file', 'terminal'],
        skills: { bundled: false, include: ['a'], preload: ['a'] },
      }),
      promptFile: '/run/prompt.txt',
      usageFile: '/run/usage.json',
      maxTurns: 9,
      runBudgetSec: 120,
    });
    expect(args.slice(0, 3)).toEqual(['--usage-file', '/run/usage.json', 'chat']);
    expect(args).toEqual(
      expect.arrayContaining([
        '--oneshot',
        '--query-file',
        '/run/prompt.txt',
        '--format',
        'stream-json',
        '--yolo',
      ]),
    );
    expect(args.join(' ')).toContain('--max-turns 9');
    expect(args.join(' ')).toContain('--run-budget 120');
    expect(args.join(' ')).toContain('--toolsets file,terminal');
    expect(args.join(' ')).toContain('--skills a');
  });
});

describe('cleanFinalAnswer', () => {
  it('removes the file-mutation verifier footer', () => {
    const text =
      '5050\n\n⚠️ File-mutation verifier: 1 file edit(s) FAILED this turn.\n  • `/x` — denied';
    expect(cleanFinalAnswer(text)).toBe('5050');
    expect(cleanFinalAnswer('  plain answer  ')).toBe('plain answer');
  });
});
