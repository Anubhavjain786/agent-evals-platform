import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ScorerSchema,
  type ScorerDefinition,
  type ScoreResult,
  type TaskDefinition,
  TaskSchema,
  type TrajectoryEvent,
} from '@agent-evals/shared';
import { describe, expect, it } from 'vitest';
import { parseVerdict } from './llm-judge.client';
import type { ScoreContext } from './scorer';
import { getPath, JsonFieldScorer, parseLooseJson } from './scorers/json-field.scorer';
import {
  ContainsScorer,
  ExactMatchScorer,
  extractNumbers,
  normalizeAnswer,
  NumericScorer,
  RegexScorer,
} from './scorers/text.scorers';
import { CommandScorer, FileExistsScorer, ToolUsageScorer } from './scorers/workspace.scorers';
import { aggregate } from './scoring.service';

const TASK: TaskDefinition = TaskSchema.parse({
  id: 't',
  name: 'T',
  prompt: 'p',
  scoring: { scorers: [{ type: 'contains', values: ['x'] }] },
});

async function context(
  finalAnswer: string,
  files: Record<string, string> = {},
  events: TrajectoryEvent[] = [],
): Promise<ScoreContext> {
  const workspaceDir = await mkdtemp(join(tmpdir(), 'scorer-'));
  for (const [path, content] of Object.entries(files))
    await writeFile(join(workspaceDir, path), content);
  return {
    task: TASK,
    finalAnswer,
    events,
    workspaceDir,
    signal: new AbortController().signal,
    readTarget: async (target) => {
      if (target === 'final_answer') return finalAnswer;
      try {
        return await readFile(join(workspaceDir, target.slice(5)), 'utf8');
      } catch {
        return null;
      }
    },
    addHiddenFixtures: async () => undefined,
  };
}

const def = <T extends ScorerDefinition['type']>(raw: { type: T } & Record<string, unknown>) =>
  ScorerSchema.parse(raw) as Extract<ScorerDefinition, { type: T }>;

describe('text helpers', () => {
  it('normalises formatting around answers', () => {
    expect(normalizeAnswer('  **req-123**. ', false)).toBe('req-123');
    expect(normalizeAnswer('`South`', false)).toBe('south');
    expect(normalizeAnswer('South', true)).toBe('South');
  });

  it('extracts numbers with separators and signs', () => {
    expect(extractNumbers('Total: $1,234.50, change -3 and 7')).toEqual([1234.5, -3, 7]);
  });
});

describe('text scorers', () => {
  it('contains: partial credit in all-mode, negation for forbidden values', async () => {
    const scorer = new ContainsScorer();
    const ctx = await context('North and South');
    const partial = await scorer.score(def({ type: 'contains', values: ['north', 'east'] }), ctx);
    expect(partial).toMatchObject({ passed: false, score: 0.5 });
    expect(
      (await scorer.score(def({ type: 'contains', values: ['east', 'south'], mode: 'any' }), ctx))
        .passed,
    ).toBe(true);
    expect(
      (await scorer.score(def({ type: 'contains', values: ['secret'], negate: true }), ctx)).passed,
    ).toBe(true);
    expect(
      (await scorer.score(def({ type: 'contains', values: ['north'], caseSensitive: true }), ctx))
        .passed,
    ).toBe(false);
  });

  it('contains on a missing file fails with a clear reason', async () => {
    const outcome = await new ContainsScorer().score(
      def({ type: 'contains', target: 'file:none.md', values: ['x'] }),
      await context(''),
    );
    expect(outcome).toMatchObject({ passed: false, reason: 'The file none.md does not exist.' });
  });

  it('exact_match ignores formatting but not content', async () => {
    const scorer = new ExactMatchScorer();
    expect(
      (
        await scorer.score(
          def({ type: 'exact_match', expected: 'req-a7c8660e02' }),
          await context('**req-a7c8660e02**'),
        )
      ).passed,
    ).toBe(true);
    expect(
      (
        await scorer.score(
          def({ type: 'exact_match', expected: 'req-a7c8660e02' }),
          await context('req-a7c8660e03'),
        )
      ).passed,
    ).toBe(false);
  });

  it('regex and numeric', async () => {
    expect(
      (
        await new RegexScorer().score(
          def({ type: 'regex', pattern: '^DATABASE_URL=', flags: 'm' }),
          await context('x\nDATABASE_URL=y'),
        )
      ).passed,
    ).toBe(true);
    const numeric = new NumericScorer();
    expect(
      (
        await numeric.score(
          def({ type: 'numeric', expected: 2.07, tolerance: 0.005 }),
          await context('About 2.069 → **2.07**'),
        )
      ).passed,
    ).toBe(true);
    expect(
      (
        await numeric.score(
          def({ type: 'numeric', expected: 35 }),
          await context('I count 34 customers'),
        )
      ).passed,
    ).toBe(false);
    expect(
      (await numeric.score(def({ type: 'numeric', expected: 35 }), await context('no idea')))
        .reason,
    ).toContain('No number');
  });
});

describe('json_field scorer', () => {
  it('parses JSON embedded in prose or fences and compares with tolerance', async () => {
    expect(parseLooseJson('Here:\n```json\n{"a": 1}\n```')).toEqual({ ok: true, value: { a: 1 } });
    expect(getPath({ a: { b: [10, 20] } }, 'a.b.1')).toEqual({ found: true, value: 20 });
    const scorer = new JsonFieldScorer();
    const ctx = await context('', { 'report.json': '{"north": 5367.654, "south": "x"}' });
    expect(
      (
        await scorer.score(
          def({
            type: 'json_field',
            target: 'file:report.json',
            path: 'north',
            expected: 5367.65,
            tolerance: 0.01,
          }),
          ctx,
        )
      ).passed,
    ).toBe(true);
    expect(
      (
        await scorer.score(
          def({ type: 'json_field', target: 'file:report.json', path: 'east', expected: 1 }),
          ctx,
        )
      ).reason,
    ).toContain('no field');
    expect(
      (
        await scorer.score(
          def({ type: 'json_field', target: 'file:missing.json', expected: 1 }),
          ctx,
        )
      ).passed,
    ).toBe(false);
  });
});

describe('workspace scorers', () => {
  it('file_exists checks presence and absence', async () => {
    const ctx = await context('', { 'a.txt': 'x' });
    const scorer = new FileExistsScorer();
    expect((await scorer.score(def({ type: 'file_exists', path: 'a.txt' }), ctx)).passed).toBe(
      true,
    );
    expect(
      (await scorer.score(def({ type: 'file_exists', path: 'b.txt', shouldExist: false }), ctx))
        .passed,
    ).toBe(true);
  });

  it('command passes on the expected exit code and captures output as evidence', async () => {
    const scorer = new CommandScorer();
    const ctx = await context('', { 'data.txt': 'hello' });
    const ok = await scorer.score(
      def({ type: 'command', run: 'grep -q hello data.txt && echo found' }),
      ctx,
    );
    expect(ok).toMatchObject({ passed: true, evidence: { exitCode: 0, stdout: 'found\n' } });
    const bad = await scorer.score(def({ type: 'command', run: 'exit 3' }), ctx);
    expect(bad).toMatchObject({ passed: false, evidence: { exitCode: 3 } });
  });

  it('command respects its timeout', async () => {
    const outcome = await new CommandScorer().score(
      def({ type: 'command', run: 'sleep 5', timeoutSec: 1 }),
      await context(''),
    );
    expect(outcome).toMatchObject({ passed: false });
    expect(outcome.reason).toContain('timed out');
  });

  it('tool_usage counts calls of a tool in the trajectory', async () => {
    const call = (name: string, seq: number): TrajectoryEvent => ({
      type: 'tool_call',
      name,
      toolCallId: String(seq),
      input: {},
      seq,
      ts: 0,
    });
    const ctx = await context('', {}, [
      call('terminal', 0),
      call('terminal', 1),
      call('read_file', 2),
    ]);
    const scorer = new ToolUsageScorer();
    expect(
      (await scorer.score(def({ type: 'tool_usage', tool: 'terminal', min: 1, max: 2 }), ctx))
        .passed,
    ).toBe(true);
    expect(
      (await scorer.score(def({ type: 'tool_usage', tool: 'terminal', max: 0 }), ctx)).passed,
    ).toBe(false);
  });
});

describe('parseVerdict', () => {
  it('accepts bare, fenced and embedded JSON and rejects out-of-range scores', () => {
    expect(parseVerdict('{"reasoning":"ok","score":8}')).toEqual({ score: 8, reasoning: 'ok' });
    expect(parseVerdict('Sure!\n```json\n{"score": 6, "reasoning": "meh"}\n```')).toEqual({
      score: 6,
      reasoning: 'meh',
    });
    expect(parseVerdict('{"score": 11}')).toBeNull();
    expect(parseVerdict('no json')).toBeNull();
  });
});

describe('aggregate', () => {
  const result = (
    score: number,
    passed: boolean,
    extra: Partial<ScoreResult> = {},
  ): ScoreResult => ({
    scorerId: 's',
    type: 'contains',
    description: null,
    weight: 1,
    required: false,
    score,
    passed,
    status: 'ok',
    reason: '',
    evidence: null,
    ...extra,
  });

  it('requires every scorer to pass by default', () => {
    expect(aggregate(TASK, [result(1, true), result(0.5, false)])).toMatchObject({
      passed: false,
      score: 0.75,
    });
    expect(aggregate(TASK, [result(1, true), result(1, true)]).passed).toBe(true);
  });

  it('grants partial credit with a pass threshold but still enforces required scorers', () => {
    const task = { ...TASK, scoring: { ...TASK.scoring, passThreshold: 0.7 } };
    expect(aggregate(task, [result(1, true, { weight: 3 }), result(0, false)])).toMatchObject({
      passed: true,
      score: 0.75,
    });
    expect(
      aggregate(task, [result(1, true, { weight: 3 }), result(0, false, { required: true })])
        .passed,
    ).toBe(false);
  });
});
