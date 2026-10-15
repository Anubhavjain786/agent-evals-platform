import type { ModelPricing, RunUsage } from '@agent-evals/shared';
import type { AgentRunStatus } from '../agent-runner';
import type { HermesResultRecord } from './stream-parser';

/** Subset of the JSON written by `hermes --usage-file`. */
export interface HermesUsageReport {
  estimated_cost_usd?: number | null;
  cost_status?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_tokens?: number | null;
  total_tokens?: number | null;
  api_calls?: number | null;
  completed?: boolean;
  partial?: boolean;
  interrupted?: boolean;
  failed?: boolean;
  turn_exit_reason?: string | null;
  failure?: string | null;
  session_id?: string | null;
  auxiliary?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_tokens?: number;
    total_tokens?: number;
    api_calls?: number;
  };
  total_including_auxiliary?: {
    estimated_cost_usd?: number | null;
    total_tokens?: number | null;
    api_calls?: number | null;
  };
}

const n = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/** Cost of a token bundle at list prices. `input` includes cached tokens. */
export function priceTokens(
  pricing: ModelPricing,
  tokens: { input: number; output: number; cacheRead: number },
): number {
  const cached = Math.min(tokens.cacheRead, tokens.input);
  const uncached = tokens.input - cached;
  const cachedRate = pricing.cachedInputPerMTok ?? pricing.inputPerMTok;
  return (
    (uncached * pricing.inputPerMTok +
      cached * cachedRate +
      tokens.output * pricing.outputPerMTok) /
    1_000_000
  );
}

/**
 * Normalises usage. Hermes' own estimate wins when it could price the model;
 * otherwise list prices from the config's pricing table are applied to main +
 * auxiliary tokens; otherwise the cost is unknown (null) rather than zero.
 */
export function toRunUsage(
  report: HermesUsageReport | null,
  result: HermesResultRecord | null,
  pricing: ModelPricing | undefined,
): RunUsage {
  const aux = report?.auxiliary ?? {};
  const input = n(report?.input_tokens) || n(result?.tokens.input);
  const output = n(report?.output_tokens) || n(result?.tokens.output);
  const cacheRead = n(report?.cache_read_tokens) || n(result?.tokens.cacheRead);
  const apiCalls = n(report?.total_including_auxiliary?.api_calls) || n(report?.api_calls);
  const totalTokens =
    n(report?.total_including_auxiliary?.total_tokens) ||
    input + output + n(aux.input_tokens) + n(aux.output_tokens);

  const hermesCost = report?.total_including_auxiliary?.estimated_cost_usd;
  const hermesPriced =
    typeof hermesCost === 'number' &&
    report?.cost_status != null &&
    report.cost_status !== 'unknown';

  let costUsd: number | null = null;
  let costSource: RunUsage['costSource'] = 'unknown';
  if (hermesPriced) {
    costUsd = hermesCost;
    costSource = 'hermes';
  } else if (pricing) {
    costUsd =
      priceTokens(pricing, { input, output, cacheRead }) +
      priceTokens(pricing, {
        input: n(aux.input_tokens),
        output: n(aux.output_tokens),
        cacheRead: n(aux.cache_read_tokens),
      });
    costSource = 'pricing_table';
  }

  return {
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    totalTokens,
    apiCalls,
    costUsd,
    costSource,
  };
}

/**
 * Errors that are not the agent's fault: provider outages, throttling, quota,
 * auth and harness start-up failures. These runs are retried, then excluded
 * from statistics instead of being scored as failures.
 */
const INFRA_ERROR =
  /\bHTTP (?:401|402|403|408|409|429|5\d\d)\b|rate[ -]?limit|overloaded|quota|billing|credits? (?:exhausted|balance)|gateway (?:could not start|inaccessible)|connection (?:refused|reset|error)|APIConnectionError|ECONNREFUSED|ENOTFOUND|service unavailable|bad gateway/i;

export function isInfraError(message: string | null | undefined): boolean {
  return !!message && INFRA_ERROR.test(message);
}

export function classifyOutcome(input: {
  result: HermesResultRecord | null;
  report: HermesUsageReport | null;
  timedOut: boolean;
  cancelled: boolean;
}): { status: AgentRunStatus; errorMessage: string | null } {
  const { result, report, timedOut, cancelled } = input;
  const error = result?.error ?? report?.failure ?? null;
  const exitReason = report?.turn_exit_reason ?? '';

  if (cancelled) return { status: 'cancelled', errorMessage: 'Run cancelled' };
  if (timedOut) return { status: 'timeout', errorMessage: 'Run exceeded its time limit' };
  if (!result) {
    return {
      status: 'infra_error',
      errorMessage: error ?? 'Hermes exited without a result record',
    };
  }
  if (isInfraError(error)) return { status: 'infra_error', errorMessage: error };
  if (/max_iterations|iteration budget/i.test(exitReason)) {
    return { status: 'max_turns', errorMessage: `Turn budget exhausted (${exitReason})` };
  }
  if (/budget|deadline|timeout/i.test(exitReason)) {
    return { status: 'timeout', errorMessage: `Run budget exhausted (${exitReason})` };
  }
  // A run that failed before a single model call never exercised the agent:
  // that is a harness problem (bad flags, config, start-up), not an agent failure.
  if (result.exitCode !== 0 && (report?.api_calls ?? 0) === 0 && result.tokens.total === 0) {
    return {
      status: 'infra_error',
      errorMessage: error ?? 'Hermes failed before calling the model',
    };
  }
  if (result.exitCode === 0) return { status: 'completed', errorMessage: null };
  return { status: 'failed', errorMessage: error ?? `Hermes exited with code ${result.exitCode}` };
}
