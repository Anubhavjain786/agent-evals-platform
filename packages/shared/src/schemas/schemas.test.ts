import { describe, expect, it } from 'vitest';
import { AgentConfigSchema } from './agent-config';
import { CreateExperimentSchema } from './experiment';
import { SCORER_TYPES, SuiteSchema, TaskSchema } from './task';

const task = (overrides: Record<string, unknown> = {}) => ({
  id: 't1',
  name: 'Task',
  prompt: 'Do it',
  scoring: { scorers: [{ type: 'contains', values: ['x'] }] },
  ...overrides,
});

describe('TaskSchema', () => {
  it('applies defaults for scorers, files and limits', () => {
    const parsed = TaskSchema.parse(task());
    expect(parsed.limits.timeoutSec).toBe(300);
    expect(parsed.files).toEqual({});
    expect(parsed.scoring.scorers[0]).toMatchObject({
      target: 'final_answer',
      weight: 1,
      required: false,
      mode: 'all',
    });
    expect(parsed.scoring.passThreshold).toBeUndefined();
  });

  it('rejects workspace paths that escape the sandbox', () => {
    expect(TaskSchema.safeParse(task({ fixtures: '../etc' })).success).toBe(false);
    expect(TaskSchema.safeParse(task({ files: { '/abs.txt': 'x' } })).success).toBe(false);
  });

  it('rejects duplicate scorer ids and malformed targets', () => {
    const dup = task({
      scoring: {
        scorers: [
          { type: 'contains', values: ['a'] },
          { type: 'contains', values: ['b'], id: 'contains-1' },
        ],
      },
    });
    expect(TaskSchema.safeParse(dup).success).toBe(false);
    const badTarget = task({
      scoring: { scorers: [{ type: 'contains', values: ['a'], target: 'stdout' }] },
    });
    expect(TaskSchema.safeParse(badTarget).success).toBe(false);
  });

  it('exposes every scorer type', () => {
    expect(SCORER_TYPES).toEqual(
      expect.arrayContaining([
        'contains',
        'exact_match',
        'regex',
        'numeric',
        'json_field',
        'file_exists',
        'command',
        'tool_usage',
        'llm_judge',
      ]),
    );
  });
});

describe('SuiteSchema', () => {
  it('rejects duplicate task ids', () => {
    const result = SuiteSchema.safeParse({ id: 's', name: 'S', tasks: [task(), task()] });
    expect(result.success).toBe(false);
  });
});

describe('AgentConfigSchema', () => {
  const base = { id: 'c', name: 'C', model: { provider: 'custom', name: 'm' } };

  it('defaults to file + terminal tools with memory and skills off', () => {
    expect(AgentConfigSchema.parse(base)).toMatchObject({
      toolsets: ['file', 'terminal'],
      memory: { enabled: false },
      skills: { bundled: false, include: [] },
      maxTurns: 20,
    });
  });

  it('requires preloaded skills to be included and API keys to be env var names', () => {
    expect(AgentConfigSchema.safeParse({ ...base, skills: { preload: ['x'] } }).success).toBe(
      false,
    );
    expect(
      AgentConfigSchema.safeParse({ ...base, model: { ...base.model, apiKeyEnv: 'sk-live-123' } })
        .success,
    ).toBe(false);
  });
});

describe('CreateExperimentSchema', () => {
  it('requires unique configs and a baseline among them', () => {
    expect(
      CreateExperimentSchema.safeParse({ name: 'x', suiteId: 's', configIds: ['a', 'a'] }).success,
    ).toBe(false);
    expect(
      CreateExperimentSchema.safeParse({
        name: 'x',
        suiteId: 's',
        configIds: ['a', 'b'],
        baselineConfigId: 'c',
      }).success,
    ).toBe(false);
    expect(
      CreateExperimentSchema.parse({ name: 'x', suiteId: 's', configIds: ['a', 'b'] }),
    ).toMatchObject({ trials: 3, concurrency: 4 });
  });
});
