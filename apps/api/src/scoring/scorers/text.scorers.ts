import type { ScorerOf } from '@agent-evals/shared';
import { Injectable } from '@nestjs/common';
import {
  describeTarget,
  type ScoreContext,
  type Scorer,
  type ScorerOutcome,
  truncate,
} from '../scorer';

const missingTarget = (target: string): ScorerOutcome => ({
  score: 0,
  passed: false,
  reason: `The ${target} does not exist.`,
});

/**
 * Normalises free-form answers for comparison: agents wrap answers in markdown
 * emphasis, code spans or quotes and append punctuation.
 */
export function normalizeAnswer(text: string, caseSensitive: boolean): string {
  let value = text.trim().replace(/\s+/g, ' ');
  value = value.replace(/^[*_`"'\s]+/, '').replace(/[*_`"'\s.!]+$/, '');
  return caseSensitive ? value : value.toLowerCase();
}

/** Extracts numbers, accepting thousands separators (`1,234.5`) and a leading minus. */
export function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g) ?? [];
  return matches.map((m) => Number(m.replace(/,/g, ''))).filter(Number.isFinite);
}

@Injectable()
export class ContainsScorer implements Scorer<'contains'> {
  readonly type = 'contains' as const;

  async score(def: ScorerOf<'contains'>, ctx: ScoreContext): Promise<ScorerOutcome> {
    const text = await ctx.readTarget(def.target);
    if (text === null) return missingTarget(describeTarget(def.target));
    const haystack = def.caseSensitive ? text : text.toLowerCase();
    const found = def.values.filter((v) =>
      haystack.includes(def.caseSensitive ? v : v.toLowerCase()),
    );
    const missing = def.values.filter((v) => !found.includes(v));
    const where = describeTarget(def.target);

    if (def.negate) {
      const passed = found.length === 0;
      return {
        score: passed ? 1 : 0,
        passed,
        reason: passed
          ? `The ${where} contains none of the forbidden values.`
          : `The ${where} contains forbidden value(s): ${found.join(', ')}.`,
        evidence: { found },
      };
    }

    const passed = def.mode === 'all' ? missing.length === 0 : found.length > 0;
    const score = def.mode === 'all' ? found.length / def.values.length : passed ? 1 : 0;
    return {
      score,
      passed,
      reason: passed
        ? `The ${where} contains ${def.mode === 'all' ? 'all' : 'at least one'} of the expected values.`
        : `The ${where} is missing: ${missing.join(', ')}.`,
      evidence: { found, missing },
    };
  }
}

@Injectable()
export class ExactMatchScorer implements Scorer<'exact_match'> {
  readonly type = 'exact_match' as const;

  async score(def: ScorerOf<'exact_match'>, ctx: ScoreContext): Promise<ScorerOutcome> {
    const text = await ctx.readTarget(def.target);
    if (text === null) return missingTarget(describeTarget(def.target));
    const actual = normalizeAnswer(text, def.caseSensitive);
    const expected = normalizeAnswer(def.expected, def.caseSensitive);
    const passed = actual === expected;
    return {
      score: passed ? 1 : 0,
      passed,
      reason: passed
        ? `The ${describeTarget(def.target)} matches "${def.expected}".`
        : `Expected "${def.expected}" but got "${truncate(text.trim(), 120)}".`,
      evidence: { expected: def.expected, actual: truncate(text, 2000) },
    };
  }
}

@Injectable()
export class RegexScorer implements Scorer<'regex'> {
  readonly type = 'regex' as const;

  async score(def: ScorerOf<'regex'>, ctx: ScoreContext): Promise<ScorerOutcome> {
    const text = await ctx.readTarget(def.target);
    if (text === null) return missingTarget(describeTarget(def.target));
    const match = new RegExp(def.pattern, def.flags).exec(text);
    return {
      score: match ? 1 : 0,
      passed: !!match,
      reason: match
        ? `The ${describeTarget(def.target)} matches /${def.pattern}/.`
        : `The ${describeTarget(def.target)} does not match /${def.pattern}/.`,
      evidence: { match: match?.[0] ?? null },
    };
  }
}

@Injectable()
export class NumericScorer implements Scorer<'numeric'> {
  readonly type = 'numeric' as const;

  async score(def: ScorerOf<'numeric'>, ctx: ScoreContext): Promise<ScorerOutcome> {
    const text = await ctx.readTarget(def.target);
    if (text === null) return missingTarget(describeTarget(def.target));
    const numbers = extractNumbers(text);
    const actual = def.pick === 'first' ? numbers[0] : numbers.at(-1);
    if (actual === undefined) {
      return {
        score: 0,
        passed: false,
        reason: `No number found in the ${describeTarget(def.target)}.`,
        evidence: { expected: def.expected },
      };
    }
    const error = Math.abs(actual - def.expected);
    const passed = error <= def.tolerance + Number.EPSILON;
    return {
      score: passed ? 1 : 0,
      passed,
      reason: passed
        ? `Got ${actual}, expected ${def.expected}${def.tolerance ? ` ± ${def.tolerance}` : ''}.`
        : `Got ${actual}, expected ${def.expected}${def.tolerance ? ` ± ${def.tolerance}` : ''} (off by ${error}).`,
      evidence: { expected: def.expected, actual, tolerance: def.tolerance },
    };
  }
}
