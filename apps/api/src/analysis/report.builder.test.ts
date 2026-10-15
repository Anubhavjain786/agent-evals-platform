import type {
  AgentConfigDefinition,
  ExperimentSnapshot,
  TaskDefinition,
} from '@agent-evals/shared';
import { describe, expect, it } from 'vitest';
import { type AnalysisRun, buildReport, decideVerdict, type ReportInput } from './report.builder';

function task(id: string): TaskDefinition {
  return {
    id,
    name: `Task ${id}`,
    tags: [],
    prompt: 'p',
    files: {},
    scoring: {
      scorers: [
        {
          type: 'contains',
          target: 'final_answer',
          values: ['x'],
          mode: 'all',
          caseSensitive: false,
          negate: false,
          weight: 1,
          required: false,
        },
      ],
    },
    limits: { timeoutSec: 60 },
  };
}

function config(id: string): AgentConfigDefinition {
  return {
    id,
    name: id.toUpperCase(),
    model: { provider: 'custom', name: id },
    toolsets: [],
    skills: { bundled: false, include: [], preload: [] },
    memory: { enabled: false, notes: [], userProfile: [] },
    maxTurns: 10,
  };
}

function run(
  taskId: string,
  configId: string,
  pass: boolean,
  extra: Partial<AnalysisRun> = {},
): AnalysisRun {
  return {
    taskId,
    configId,
    status: 'completed',
    outcome: pass ? 'pass' : 'fail',
    score: pass ? 1 : 0,
    costUsd: 0.01,
    durationMs: 1000,
    totalTokens: 500,
    toolCalls: 2,
    hasScorerError: false,
    ...extra,
  };
}

function input(
  runs: AnalysisRun[],
  taskCount: number,
  overrides: Partial<ReportInput> = {},
): ReportInput {
  const snapshot: ExperimentSnapshot = {
    suite: {
      id: 's',
      name: 'S',
      tasks: Array.from({ length: taskCount }, (_, i) => task(`t${i}`)),
    },
    suiteVersion: 'v1',
    configs: [config('a'), config('b')],
    configVersions: { a: '1', b: '1' },
  };
  return {
    experimentId: 'e',
    status: 'completed',
    baselineConfigId: 'a',
    trials: 3,
    seed: 1,
    snapshot,
    runs,
    ...overrides,
  };
}

describe('buildReport', () => {
  it('declares a clearly better candidate significant', () => {
    const runs: AnalysisRun[] = [];
    for (let t = 0; t < 12; t += 1) {
      for (let trial = 0; trial < 3; trial += 1) {
        runs.push(run(`t${t}`, 'a', trial === 0 && t % 3 === 0)); // baseline ≈ 11% pass
        runs.push(run(`t${t}`, 'b', !(trial === 0 && t % 4 === 0))); // candidate ≈ 92% pass
      }
    }
    const report = buildReport(input(runs, 12));
    const [comparison] = report.comparisons;
    expect(comparison?.verdict).toBe('better');
    expect(comparison?.passRate.delta).toBeGreaterThan(0.7);
    expect(comparison?.passRate.ci.low).toBeGreaterThan(0);
    expect(comparison?.passRate.pValueAdjusted).toBeLessThan(0.05);
    expect(comparison?.wins).toBe(12);
    expect(comparison?.summary).toContain('is better than');
    expect(report.configs.map((c) => c.scoredRuns)).toEqual([36, 36]);
  });

  it('reports no detectable difference for identical configs and states the sensitivity', () => {
    const runs: AnalysisRun[] = [];
    for (let t = 0; t < 12; t += 1) {
      for (let trial = 0; trial < 3; trial += 1) {
        const pass = (t + trial) % 2 === 0;
        runs.push(
          run(`t${t}`, 'a', pass),
          run(`t${t}`, 'b', (t + trial + (t % 3 === 0 ? 1 : 0)) % 2 === 0),
        );
      }
    }
    const [comparison] = buildReport(input(runs, 12)).comparisons;
    expect(comparison?.verdict).toBe('no_detectable_difference');
    expect(comparison?.passRate.ci.low).toBeLessThan(0);
    expect(comparison?.passRate.ci.high).toBeGreaterThan(0);
    expect(comparison?.summary).toContain('only differences of about');
  });

  it('excludes infrastructure errors from statistics but counts them and warns', () => {
    const runs = [
      run('t0', 'a', true),
      run('t0', 'b', true),
      run('t1', 'a', false),
      run('t1', 'b', false, { status: 'error', outcome: null, score: null }),
    ];
    const report = buildReport(input(runs, 2));
    const b = report.configs.find((c) => c.configId === 'b');
    expect(b?.scoredRuns).toBe(1);
    expect(b?.errorRuns).toBe(1);
    expect(report.comparisons[0]?.verdict).toBe('insufficient_data');
    expect(report.warnings.some((w) => w.includes('infrastructure errors'))).toBe(true);
  });

  it('flags flaky tasks and warns while the experiment is running', () => {
    const runs = [
      run('t0', 'a', true),
      run('t0', 'a', false),
      run('t0', 'b', true),
      run('t0', 'b', true),
    ];
    const report = buildReport(input(runs, 1, { status: 'running' }));
    expect(report.tasks[0]?.flaky).toBe(true);
    expect(report.tasks[0]?.cells[0]).toMatchObject({ runs: 2, passes: 1, passRate: 0.5 });
    expect(report.warnings[0]).toContain('still running');
  });

  it('is reproducible for a given seed', () => {
    const runs = Array.from({ length: 8 }, (_, t) => [
      run(`t${t}`, 'a', t % 2 === 0),
      run(`t${t}`, 'b', t % 3 !== 0),
    ]).flat();
    const a = buildReport(input(runs, 8));
    const b = buildReport(input(runs, 8));
    expect(a.comparisons).toEqual(b.comparisons);
    expect(a.configs).toEqual(b.configs);
  });
});

describe('decideVerdict', () => {
  const metric = (delta: number, low: number, high: number, p: number) => ({
    baseline: 0.5,
    candidate: 0.5 + delta,
    delta,
    ci: { low, high },
    pValue: p,
    pValueAdjusted: p,
  });

  it('requires both a small adjusted p-value and an interval excluding zero', () => {
    expect(decideVerdict(10, metric(0.2, 0.05, 0.35, 0.01))).toBe('better');
    expect(decideVerdict(10, metric(-0.2, -0.35, -0.05, 0.01))).toBe('worse');
    expect(decideVerdict(10, metric(0.2, -0.01, 0.35, 0.01))).toBe('no_detectable_difference');
    expect(decideVerdict(10, metric(0.2, 0.05, 0.35, 0.2))).toBe('no_detectable_difference');
    expect(decideVerdict(1, metric(0.2, 0.05, 0.35, 0.01))).toBe('insufficient_data');
  });
});
