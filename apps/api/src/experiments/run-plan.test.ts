import { describe, expect, it } from 'vitest';
import { planRuns } from './run-plan';

describe('planRuns', () => {
  const input = {
    experimentId: 'e',
    taskIds: ['t1', 't2', 't3'],
    configIds: ['a', 'b'],
    trials: 3,
    seed: 99,
  };

  it('creates one run per task × config × trial with a contiguous queue order', () => {
    const plan = planRuns(input);
    expect(plan).toHaveLength(18);
    expect(new Set(plan.map((r) => `${r.taskId}/${r.configId}/${r.trial}`)).size).toBe(18);
    expect(plan.map((r) => r.queueOrder).sort((x, y) => x - y)).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
  });

  it('interleaves configs in a seed-determined order', () => {
    const order = (seed: number) =>
      planRuns({ ...input, seed }).map((r) => `${r.taskId}/${r.configId}/${r.trial}`);
    expect(order(99)).toEqual(order(99));
    expect(order(99)).not.toEqual(order(100));
    const firstHalf = planRuns(input)
      .slice(0, 9)
      .map((r) => r.configId);
    expect(new Set(firstHalf)).toEqual(new Set(['a', 'b']));
  });
});
