import { describe, expect, it } from 'vitest';
import {
  clusterBootstrapMean,
  holmAdjust,
  mean,
  minimumDetectableEffect,
  mulberry32,
  normalQuantile,
  pairedClusterBootstrapDiff,
  quantile,
  sampleStdDev,
  shuffle,
  signFlipTest,
} from './stats';

describe('mulberry32', () => {
  it('is deterministic for a seed and stays within [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const draws = Array.from({ length: 1000 }, () => a());
    expect(draws).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(Math.min(...draws)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...draws)).toBeLessThan(1);
    expect(mean(draws)).toBeCloseTo(0.5, 1);
  });
});

describe('shuffle', () => {
  it('returns a permutation and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const output = shuffle(input, mulberry32(1));
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...output].sort()).toEqual(input);
    expect(output).not.toEqual(input);
  });
});

describe('descriptive statistics', () => {
  it('computes mean, sample standard deviation and quantiles', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(Number.isNaN(mean([]))).toBe(true);
    expect(sampleStdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75);
  });
});

describe('normalQuantile', () => {
  it('matches standard normal table values', () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalQuantile(0.8)).toBeCloseTo(0.841621, 5);
    expect(normalQuantile(0.5)).toBeCloseTo(0, 9);
    expect(normalQuantile(0.001)).toBeCloseTo(-3.090232, 5);
  });

  it('rejects probabilities outside (0, 1)', () => {
    expect(() => normalQuantile(0)).toThrow(RangeError);
    expect(() => normalQuantile(1)).toThrow(RangeError);
  });
});

describe('signFlipTest', () => {
  const options = { iterations: 20_000, rng: mulberry32(7) };

  it('returns 1 when there is no difference at all', () => {
    expect(signFlipTest([0, 0, 0], options)).toBe(1);
  });

  it('computes the exact two-sided p-value for small n', () => {
    // All 5 differences positive: only the all-plus and all-minus assignments are as extreme.
    expect(signFlipTest([1, 1, 1, 1, 1], options)).toBeCloseTo(2 / 32, 10);
    // Zeros do not change the p-value.
    expect(signFlipTest([1, 1, 1, 1, 1, 0, 0], options)).toBeCloseTo(2 / 32, 10);
  });

  it('is symmetric in the sign of the effect', () => {
    const diffs = [0.3, 0.5, -0.1, 0.7, 0.2, 0.4];
    expect(signFlipTest(diffs, options)).toBeCloseTo(
      signFlipTest(
        diffs.map((d) => -d),
        options,
      ),
      10,
    );
  });

  it('approximates the exact p-value with Monte Carlo above the exact limit', () => {
    const diffs = Array.from({ length: 20 }, (_, i) => (i % 4 === 0 ? -0.2 : 0.4));
    const p = signFlipTest(diffs, options);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(0.01);
  });
});

describe('holmAdjust', () => {
  it('applies the step-down correction and keeps monotonicity', () => {
    expect(holmAdjust([0.01, 0.04, 0.03])).toEqual([0.03, 0.06, 0.06]);
    expect(holmAdjust([0.5])).toEqual([0.5]);
    expect(holmAdjust([0.9, 0.8])).toEqual([1, 1]); // 2 × 0.8 is capped at 1
  });
});

describe('cluster bootstrap', () => {
  const bootstrap = () => ({ iterations: 3000, confidence: 0.95, rng: mulberry32(3) });

  it('gives a degenerate interval when every observation is identical', () => {
    expect(
      clusterBootstrapMean(
        [
          [1, 1],
          [1, 1, 1],
        ],
        bootstrap(),
      ),
    ).toEqual({ low: 1, high: 1 });
  });

  it('covers the true mean and narrows with more tasks', () => {
    const small = Array.from({ length: 6 }, (_, i) => [i % 2, (i + 1) % 2, i % 2]);
    const large = Array.from({ length: 60 }, (_, i) => [i % 2, (i + 1) % 2, i % 2]);
    const a = clusterBootstrapMean(small, bootstrap());
    const b = clusterBootstrapMean(large, bootstrap());
    expect(a.low).toBeLessThan(0.5);
    expect(a.high).toBeGreaterThan(0.5);
    expect(b.high - b.low).toBeLessThan(a.high - a.low);
  });

  it('centres paired differences on the observed effect', () => {
    const tasks = Array.from({ length: 12 }, () => ({ baseline: [0, 0, 1], candidate: [1, 1, 1] }));
    const ci = pairedClusterBootstrapDiff(tasks, bootstrap());
    expect(ci.low).toBeGreaterThan(0.3);
    expect(ci.high).toBeLessThanOrEqual(1);
  });

  it('returns NaN bounds without data', () => {
    const ci = pairedClusterBootstrapDiff([], bootstrap());
    expect(Number.isNaN(ci.low) && Number.isNaN(ci.high)).toBe(true);
  });
});

describe('minimumDetectableEffect', () => {
  it('follows (z₁₋α/₂ + z_power) · sd / √n', () => {
    const diffs = [0.2, -0.1, 0.4, 0, 0.3, -0.2, 0.1, 0.5];
    const expected = ((1.959964 + 0.841621) * sampleStdDev(diffs)) / Math.sqrt(diffs.length);
    expect(minimumDetectableEffect(diffs, 0.05, 0.8)).toBeCloseTo(expected, 4);
  });

  it('is undefined with fewer than two tasks or zero spread', () => {
    expect(minimumDetectableEffect([0.3], 0.05, 0.8)).toBeNull();
    expect(minimumDetectableEffect([0, 0, 0], 0.05, 0.8)).toBeNull();
  });
});
