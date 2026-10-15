/**
 * Statistics for comparing agent configurations.
 *
 * The unit of analysis is the TASK. Trials of the same task are correlated
 * (same prompt, same difficulty), so treating every run as independent would
 * overstate confidence. Every interval here resamples tasks first and trials
 * within tasks second (a two-level cluster bootstrap), and every test is
 * paired by task.
 *
 * All functions are pure and take an explicit RNG, so a report is
 * reproducible from the experiment's seed.
 */

import type { Interval } from '@agent-evals/shared';

export type Rng = () => number;

/** Small, fast, seedable PRNG (Mulberry32). */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

export function sampleStdDev(values: readonly number[]): number {
  if (values.length < 2) return Number.NaN;
  const m = mean(values);
  let ss = 0;
  for (const v of values) ss += (v - m) ** 2;
  return Math.sqrt(ss / (values.length - 1));
}

/** Linear-interpolated quantile of an ascending-sorted array. */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

/** Inverse standard normal CDF (Acklam's rational approximation, |error| < 1.2e-9). */
export function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) throw new RangeError('p must be in (0, 1)');
  const a = [
    -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716,
    2.506628277459239,
  ];
  const b = [
    -54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972,
    -13.28068155288572,
  ];
  const c = [
    -0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p > 1 - low) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
  );
}

function resample(values: readonly number[], rng: Rng): number[] {
  const out = new Array<number>(values.length);
  for (let i = 0; i < values.length; i += 1) out[i] = values[Math.floor(rng() * values.length)]!;
  return out;
}

function percentileInterval(estimates: number[], confidence: number): Interval {
  estimates.sort((x, y) => x - y);
  const tail = (1 - confidence) / 2;
  return { low: quantile(estimates, tail), high: quantile(estimates, 1 - tail) };
}

export interface BootstrapOptions {
  iterations: number;
  confidence: number;
  rng: Rng;
}

/**
 * CI for the mean of per-task means. `groups[i]` holds the trial values of task i.
 */
export function clusterBootstrapMean(
  groups: readonly number[][],
  options: BootstrapOptions,
): Interval {
  const nonEmpty = groups.filter((g) => g.length > 0);
  if (nonEmpty.length === 0) return { low: Number.NaN, high: Number.NaN };
  const estimates: number[] = [];
  for (let i = 0; i < options.iterations; i += 1) {
    let total = 0;
    for (let t = 0; t < nonEmpty.length; t += 1) {
      const group = nonEmpty[Math.floor(options.rng() * nonEmpty.length)]!;
      total += mean(resample(group, options.rng));
    }
    estimates.push(total / nonEmpty.length);
  }
  return percentileInterval(estimates, options.confidence);
}

export interface PairedTask {
  baseline: number[];
  candidate: number[];
}

/** CI for mean over tasks of (candidate mean − baseline mean), resampling tasks then trials. */
export function pairedClusterBootstrapDiff(
  tasks: readonly PairedTask[],
  options: BootstrapOptions,
): Interval {
  if (tasks.length === 0) return { low: Number.NaN, high: Number.NaN };
  const estimates: number[] = [];
  for (let i = 0; i < options.iterations; i += 1) {
    let total = 0;
    for (let t = 0; t < tasks.length; t += 1) {
      const task = tasks[Math.floor(options.rng() * tasks.length)]!;
      total +=
        mean(resample(task.candidate, options.rng)) - mean(resample(task.baseline, options.rng));
    }
    estimates.push(total / tasks.length);
  }
  return percentileInterval(estimates, options.confidence);
}

const EXACT_SIGN_FLIP_MAX_N = 16;

/**
 * Two-sided paired permutation (sign-flip) test of H0: mean difference = 0.
 * Under H0 the label "baseline"/"candidate" within a task is exchangeable, so
 * every difference's sign is equally likely. Exact for n ≤ 16 non-zero
 * differences; Monte Carlo (with the +1 correction) above that.
 */
export function signFlipTest(
  diffs: readonly number[],
  options: { iterations: number; rng: Rng },
): number {
  // Zero differences contribute nothing to any permuted sum; dropping them leaves p unchanged.
  const nonZero = diffs.filter((d) => Math.abs(d) > 1e-12);
  const n = nonZero.length;
  if (n === 0) return 1;
  const observed = Math.abs(nonZero.reduce((s, d) => s + d, 0));
  const tolerance = 1e-9;

  if (n <= EXACT_SIGN_FLIP_MAX_N) {
    let extreme = 0;
    const total = 1 << n;
    for (let mask = 0; mask < total; mask += 1) {
      let sum = 0;
      for (let i = 0; i < n; i += 1) sum += mask & (1 << i) ? -nonZero[i]! : nonZero[i]!;
      if (Math.abs(sum) >= observed - tolerance) extreme += 1;
    }
    return extreme / total;
  }

  let extreme = 0;
  for (let i = 0; i < options.iterations; i += 1) {
    let sum = 0;
    for (const d of nonZero) sum += options.rng() < 0.5 ? -d : d;
    if (Math.abs(sum) >= observed - tolerance) extreme += 1;
  }
  return (extreme + 1) / (options.iterations + 1);
}

/** Holm–Bonferroni step-down adjustment; controls family-wise error across comparisons. */
export function holmAdjust(pValues: readonly number[]): number[] {
  const m = pValues.length;
  const order = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const adjusted = new Array<number>(m);
  let running = 0;
  order.forEach(({ p, i }, rank) => {
    running = Math.max(running, Math.min(1, (m - rank) * p));
    adjusted[i] = running;
  });
  return adjusted;
}

/**
 * Smallest true mean difference a paired design with these per-task differences
 * would detect with the given power (normal approximation). `null` when the
 * spread of differences is unknown (fewer than 2 tasks) or degenerate (zero).
 */
export function minimumDetectableEffect(
  diffs: readonly number[],
  alpha: number,
  power: number,
): number | null {
  const sd = sampleStdDev(diffs);
  if (!Number.isFinite(sd) || sd === 0) return null;
  return ((normalQuantile(1 - alpha / 2) + normalQuantile(power)) * sd) / Math.sqrt(diffs.length);
}
