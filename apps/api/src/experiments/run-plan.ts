import { randomUUID } from 'node:crypto';
import { mulberry32, shuffle } from '../analysis/stats';
import type { NewRun } from './runs.repository';

/**
 * Expands an experiment into (task × config × trial) runs in a seeded random
 * order. Interleaving configs over time means provider slowdowns, rate limits
 * or outages hit every config alike instead of biasing whichever ran last.
 */
export function planRuns(input: {
  experimentId: string;
  taskIds: string[];
  configIds: string[];
  trials: number;
  seed: number;
}): NewRun[] {
  const cells: Omit<NewRun, 'queueOrder'>[] = [];
  for (const taskId of input.taskIds) {
    for (const configId of input.configIds) {
      for (let trial = 1; trial <= input.trials; trial += 1) {
        cells.push({ id: randomUUID(), experimentId: input.experimentId, taskId, configId, trial });
      }
    }
  }
  return shuffle(cells, mulberry32(input.seed)).map((cell, index) => ({
    ...cell,
    queueOrder: index + 1,
  }));
}
