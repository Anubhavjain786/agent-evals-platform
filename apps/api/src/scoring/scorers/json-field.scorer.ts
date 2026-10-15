import { isDeepStrictEqual } from 'node:util';
import type { ScorerOf } from '@agent-evals/shared';
import { Injectable } from '@nestjs/common';
import {
  describeTarget,
  type ScoreContext,
  type Scorer,
  type ScorerOutcome,
  truncate,
} from '../scorer';

/** Parses JSON, falling back to the first fenced or brace-delimited block (answers often wrap JSON in prose). */
export function parseLooseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  const candidates = [
    text,
    /```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1],
    /[[{][\s\S]*[\]}]/.exec(text)?.[0],
  ];
  for (const candidate of candidates) {
    if (candidate === undefined) continue;
    try {
      return { ok: true, value: JSON.parse(candidate) };
    } catch {
      // Try the next candidate.
    }
  }
  return { ok: false };
}

export function getPath(value: unknown, path: string): { found: boolean; value: unknown } {
  if (!path) return { found: true, value };
  let current: unknown = value;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return { found: false, value: undefined };
    if (!(segment in (current as Record<string, unknown>)))
      return { found: false, value: undefined };
    current = (current as Record<string, unknown>)[segment];
  }
  return { found: true, value: current };
}

function matches(actual: unknown, expected: unknown, tolerance: number): boolean {
  if (typeof actual === 'number' && typeof expected === 'number') {
    return Math.abs(actual - expected) <= tolerance + Number.EPSILON;
  }
  return isDeepStrictEqual(actual, expected);
}

@Injectable()
export class JsonFieldScorer implements Scorer<'json_field'> {
  readonly type = 'json_field' as const;

  async score(def: ScorerOf<'json_field'>, ctx: ScoreContext): Promise<ScorerOutcome> {
    const where = describeTarget(def.target);
    const text = await ctx.readTarget(def.target);
    if (text === null) return { score: 0, passed: false, reason: `The ${where} does not exist.` };

    const parsed = parseLooseJson(text);
    if (!parsed.ok) {
      return {
        score: 0,
        passed: false,
        reason: `The ${where} is not valid JSON.`,
        evidence: { content: truncate(text, 500) },
      };
    }
    const field = getPath(parsed.value, def.path);
    const label = def.path ? `"${def.path}"` : 'the document';
    if (!field.found) {
      return { score: 0, passed: false, reason: `The ${where} has no field ${label}.` };
    }
    const passed = matches(field.value, def.expected, def.tolerance);
    return {
      score: passed ? 1 : 0,
      passed,
      reason: passed
        ? `${label} equals ${JSON.stringify(def.expected)}.`
        : `${label} is ${truncate(JSON.stringify(field.value), 120)}, expected ${truncate(JSON.stringify(def.expected), 120)}.`,
      evidence: { path: def.path, expected: def.expected, actual: field.value },
    };
  }
}
