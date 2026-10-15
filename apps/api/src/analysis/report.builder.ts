import type {
  ConfigStats,
  ExperimentReport,
  ExperimentSnapshot,
  ExperimentStatus,
  MetricComparison,
  PairwiseComparison,
  TaskCell,
  TaskRow,
  Verdict,
} from '@agent-evals/shared';
import {
  clusterBootstrapMean,
  holmAdjust,
  mean,
  minimumDetectableEffect,
  mulberry32,
  type PairedTask,
  pairedClusterBootstrapDiff,
  quantile,
  type Rng,
  signFlipTest,
} from './stats';

/** The slice of a run the analysis needs. */
export interface AnalysisRun {
  taskId: string;
  configId: string;
  status: 'queued' | 'running' | 'completed' | 'error' | 'cancelled';
  outcome: 'pass' | 'fail' | null;
  score: number | null;
  costUsd: number | null;
  durationMs: number | null;
  totalTokens: number | null;
  toolCalls: number | null;
  hasScorerError: boolean;
}

export interface ReportInput {
  experimentId: string;
  status: ExperimentStatus;
  baselineConfigId: string;
  trials: number;
  seed: number;
  snapshot: ExperimentSnapshot;
  runs: AnalysisRun[];
}

export const CONFIDENCE = 0.95;
export const ALPHA = 1 - CONFIDENCE;
const POWER = 0.8;
const BOOTSTRAP_ITERATIONS = 4000;
const PERMUTATION_ITERATIONS = 20000;

const METHOD = [
  'Each task counts once: we take the average of its tries, so every task has the same weight.',
  `The ${CONFIDENCE * 100}% ranges come from a two-level bootstrap: we pick tasks at random (with repeats), then tries within each task, recompute the result ${BOOTSTRAP_ITERATIONS} times, and keep the middle ${CONFIDENCE * 100}%.`,
  'The configs are compared task by task. The p-value comes from a sign-flip test on the per-task differences (exact for up to 16 tasks) and is adjusted with the Holm method, because several configs may be compared with the baseline.',
  `We call a difference real only when the adjusted p-value is below ${ALPHA.toFixed(2)} and the range does not include zero.`,
  'Runs that failed because of provider or setup problems (infrastructure errors) are left out; timeouts and running out of turns count as failures.',
  'All random steps use the experiment seed, so the same data always gives the same report.',
].join(' ');

const pct = (value: number): string => `${(value * 100).toFixed(1)}`;
const signedPp = (value: number): string => `${value >= 0 ? '+' : '−'}${pct(Math.abs(value))} pp`;
const formatP = (p: number): string => (p < 0.001 ? '< 0.001' : p.toFixed(3));

interface Cell {
  passes: number[];
  scores: number[];
  costs: number[];
  durations: number[];
  tokens: number[];
  toolCalls: number[];
  errors: number;
}

function emptyCell(): Cell {
  return { passes: [], scores: [], costs: [], durations: [], tokens: [], toolCalls: [], errors: 0 };
}

const meanOrNull = (values: number[]): number | null => (values.length > 0 ? mean(values) : null);

export function buildReport(input: ReportInput): ExperimentReport {
  const { snapshot } = input;
  const configIds = snapshot.configs.map((c) => c.id);
  const configNames = new Map(snapshot.configs.map((c) => [c.id, c.name]));
  const tasks = snapshot.suite.tasks;

  // cells[taskId][configId]
  const cells = new Map<string, Map<string, Cell>>();
  for (const task of tasks) cells.set(task.id, new Map(configIds.map((id) => [id, emptyCell()])));
  const totalCostByConfig = new Map(configIds.map((id) => [id, 0]));
  let scorerErrorRuns = 0;
  let errorRuns = 0;

  for (const run of input.runs) {
    const cell = cells.get(run.taskId)?.get(run.configId);
    if (!cell) continue;
    if (run.costUsd !== null) {
      totalCostByConfig.set(run.configId, (totalCostByConfig.get(run.configId) ?? 0) + run.costUsd);
    }
    if (run.status === 'error') {
      cell.errors += 1;
      errorRuns += 1;
      continue;
    }
    if (run.status !== 'completed' || run.outcome === null || run.score === null) continue;
    if (run.hasScorerError) scorerErrorRuns += 1;
    cell.passes.push(run.outcome === 'pass' ? 1 : 0);
    cell.scores.push(run.score);
    if (run.costUsd !== null) cell.costs.push(run.costUsd);
    if (run.durationMs !== null) cell.durations.push(run.durationMs);
    if (run.totalTokens !== null) cell.tokens.push(run.totalTokens);
    if (run.toolCalls !== null) cell.toolCalls.push(run.toolCalls);
  }

  const rng: Rng = mulberry32(input.seed);
  const bootstrap = { iterations: BOOTSTRAP_ITERATIONS, confidence: CONFIDENCE, rng };

  const configStats: ConfigStats[] = configIds.map((configId) => {
    const perTask = tasks.map((t) => cells.get(t.id)!.get(configId)!);
    const scored = perTask.filter((c) => c.passes.length > 0);
    const all = <K extends keyof Cell>(key: K): number[] =>
      perTask.flatMap((c) => c[key] as number[]);
    const passes = all('passes');
    const costs = all('costs');
    const durations = all('durations').sort((a, b) => a - b);
    const passCount = passes.reduce((s, p) => s + p, 0);
    return {
      configId,
      configName: configNames.get(configId) ?? configId,
      scoredRuns: passes.length,
      errorRuns: perTask.reduce((s, c) => s + c.errors, 0),
      passRate: {
        value: meanOrNull(scored.map((c) => mean(c.passes))) ?? Number.NaN,
        ci: clusterBootstrapMean(
          scored.map((c) => c.passes),
          bootstrap,
        ),
      },
      meanScore: {
        value: meanOrNull(scored.map((c) => mean(c.scores))) ?? Number.NaN,
        ci: clusterBootstrapMean(
          scored.map((c) => c.scores),
          bootstrap,
        ),
      },
      meanCostUsd: meanOrNull(costs),
      totalCostUsd: totalCostByConfig.get(configId) ?? 0,
      costPerPassUsd:
        passCount > 0 && costs.length === passes.length
          ? costs.reduce((s, c) => s + c, 0) / passCount
          : null,
      meanDurationMs: meanOrNull(durations),
      p95DurationMs: durations.length > 0 ? quantile(durations, 0.95) : null,
      meanTokens: meanOrNull(all('tokens')),
      meanToolCalls: meanOrNull(all('toolCalls')),
    };
  });

  const baselineId = input.baselineConfigId;
  const candidates = configIds.filter((id) => id !== baselineId);

  const raw = candidates.map((candidateId) => {
    const paired = tasks
      .map((t) => ({
        base: cells.get(t.id)!.get(baselineId)!,
        cand: cells.get(t.id)!.get(candidateId)!,
      }))
      .filter(({ base, cand }) => base.passes.length > 0 && cand.passes.length > 0);
    const metric = (key: 'passes' | 'scores') => {
      const pairs: PairedTask[] = paired.map(({ base, cand }) => ({
        baseline: base[key],
        candidate: cand[key],
      }));
      const diffs = pairs.map((p) => mean(p.candidate) - mean(p.baseline));
      return {
        baseline: meanOrNull(pairs.map((p) => mean(p.baseline))) ?? Number.NaN,
        candidate: meanOrNull(pairs.map((p) => mean(p.candidate))) ?? Number.NaN,
        delta: meanOrNull(diffs) ?? Number.NaN,
        ci: pairedClusterBootstrapDiff(pairs, bootstrap),
        pValue: signFlipTest(diffs, { iterations: PERMUTATION_ITERATIONS, rng }),
        diffs,
      };
    };
    return { candidateId, paired, passMetric: metric('passes'), scoreMetric: metric('scores') };
  });

  const passAdjusted = holmAdjust(raw.map((r) => r.passMetric.pValue));
  const scoreAdjusted = holmAdjust(raw.map((r) => r.scoreMetric.pValue));

  const comparisons: PairwiseComparison[] = raw.map((r, index) => {
    const toMetric = (m: typeof r.passMetric, adjusted: number): MetricComparison => ({
      baseline: m.baseline,
      candidate: m.candidate,
      delta: m.delta,
      ci: m.ci,
      pValue: m.pValue,
      pValueAdjusted: adjusted,
    });
    const passRate = toMetric(r.passMetric, passAdjusted[index]!);
    const meanScore = toMetric(r.scoreMetric, scoreAdjusted[index]!);
    const wins = r.scoreMetric.diffs.filter((d) => d > 1e-9).length;
    const losses = r.scoreMetric.diffs.filter((d) => d < -1e-9).length;
    const mde = minimumDetectableEffect(r.passMetric.diffs, ALPHA, POWER);
    const verdict = decideVerdict(r.paired.length, passRate);
    const base = configStats.find((c) => c.configId === baselineId)!;
    const cand = configStats.find((c) => c.configId === r.candidateId)!;
    return {
      baselineConfigId: baselineId,
      candidateConfigId: r.candidateId,
      pairedTasks: r.paired.length,
      passRate,
      meanScore,
      wins,
      losses,
      ties: r.paired.length - wins - losses,
      minimumDetectableEffect: mde,
      verdict,
      summary: summarize({
        verdict,
        passRate,
        mde,
        pairedTasks: r.paired.length,
        candidateName: configNames.get(r.candidateId) ?? r.candidateId,
        baselineName: configNames.get(baselineId) ?? baselineId,
      }),
      costDeltaUsd:
        base.meanCostUsd !== null && cand.meanCostUsd !== null
          ? cand.meanCostUsd - base.meanCostUsd
          : null,
      durationDeltaMs:
        base.meanDurationMs !== null && cand.meanDurationMs !== null
          ? cand.meanDurationMs - base.meanDurationMs
          : null,
    };
  });

  const taskRows: TaskRow[] = tasks.map((task) => {
    const row: TaskCell[] = configIds.map((configId) => {
      const cell = cells.get(task.id)!.get(configId)!;
      const passes = cell.passes.reduce((s, p) => s + p, 0);
      return {
        configId,
        runs: cell.passes.length,
        passes,
        errors: cell.errors,
        passRate: meanOrNull(cell.passes),
        meanScore: meanOrNull(cell.scores),
        meanCostUsd: meanOrNull(cell.costs),
        meanDurationMs: meanOrNull(cell.durations),
      };
    });
    return {
      taskId: task.id,
      taskName: task.name,
      tags: task.tags,
      cells: row,
      flaky: row.some((c) => c.runs > 1 && c.passes > 0 && c.passes < c.runs),
    };
  });

  return {
    experimentId: input.experimentId,
    generatedAt: new Date().toISOString(),
    confidenceLevel: CONFIDENCE,
    alpha: ALPHA,
    baselineConfigId: baselineId,
    configs: configStats,
    comparisons,
    tasks: taskRows,
    warnings: buildWarnings({ input, comparisons, configStats, errorRuns, scorerErrorRuns }),
    method: METHOD,
  };
}

export function decideVerdict(pairedTasks: number, passRate: MetricComparison): Verdict {
  if (pairedTasks < 2 || !Number.isFinite(passRate.delta)) return 'insufficient_data';
  const significant = passRate.pValueAdjusted < ALPHA;
  if (significant && passRate.ci.low > 0) return 'better';
  if (significant && passRate.ci.high < 0) return 'worse';
  return 'no_detectable_difference';
}

function summarize(input: {
  verdict: Verdict;
  passRate: MetricComparison;
  mde: number | null;
  pairedTasks: number;
  candidateName: string;
  baselineName: string;
}): string {
  const { passRate: m, candidateName, baselineName } = input;
  if (input.verdict === 'insufficient_data') {
    return `Not enough results to compare ${candidateName} with ${baselineName} (both need results on at least 2 of the same tasks).`;
  }
  const stats = `${signedPp(m.delta)} pass rate (95% range ${signedPp(m.ci.low)} to ${signedPp(m.ci.high)}; p ${m.pValueAdjusted < 0.001 ? '< 0.001' : `= ${formatP(m.pValueAdjusted)}`} after adjusting for multiple comparisons; ${input.pairedTasks} tasks)`;
  if (input.verdict === 'better')
    return `${candidateName} is better than ${baselineName}: ${stats}.`;
  if (input.verdict === 'worse') return `${candidateName} is worse than ${baselineName}: ${stats}.`;
  const sensitivity =
    input.mde !== null
      ? ` With this many tasks and this much variation, only differences of about ${pct(input.mde)} pp or more would be reliably detected.`
      : '';
  return `No detectable difference between ${candidateName} and ${baselineName}: ${stats}.${sensitivity}`;
}

function buildWarnings(input: {
  input: ReportInput;
  comparisons: PairwiseComparison[];
  configStats: ConfigStats[];
  errorRuns: number;
  scorerErrorRuns: number;
}): string[] {
  const warnings: string[] = [];
  const { status, trials } = input.input;
  if (status === 'queued' || status === 'running') {
    warnings.push(
      'The experiment is still running, so these results are not final and will change.',
    );
  }
  if (status === 'cancelled')
    warnings.push(
      'The experiment was cancelled, so these results only include the runs that finished.',
    );
  if (input.errorRuns > 0) {
    warnings.push(
      `${input.errorRuns} run(s) failed because of provider or setup problems (infrastructure errors) and are left out of the statistics. Retry them so both configs have the same number of runs.`,
    );
  }
  if (input.scorerErrorRuns > 0) {
    warnings.push(
      `${input.scorerErrorRuns} run(s) had a check that could not run (for example, the LLM judge was not reachable); those checks counted as failed.`,
    );
  }
  if (trials === 1) {
    warnings.push(
      'Each task ran only once per config, so we cannot tell luck from skill on single tasks. Use 3 or more tries for more reliable ranges.',
    );
  }
  const minPaired = Math.min(...input.comparisons.map((c) => c.pairedTasks));
  if (input.comparisons.length > 0 && minPaired < 10) {
    warnings.push(
      `Only ${minPaired} task(s) can be compared, so the ranges are wide and only big differences can be noticed.`,
    );
  }
  const unknownCost = input.configStats.filter((c) => c.scoredRuns > 0 && c.meanCostUsd === null);
  if (unknownCost.length > 0) {
    warnings.push(
      `Cost is unknown for ${unknownCost.map((c) => c.configName).join(', ')} (Hermes does not know the price and the config has no prices).`,
    );
  }
  return warnings;
}
