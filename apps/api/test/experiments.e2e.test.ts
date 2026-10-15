import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  ExperimentDetail,
  ExperimentReport,
  RunDetail,
  RunSummary,
} from '@agent-evals/shared';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { stringify as toYaml } from 'yaml';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import {
  AGENT_RUNNER,
  type AgentRunner,
  type AgentRunRequest,
  type AgentRunResult,
} from '../src/execution/agent-runner';

const TASKS = Array.from({ length: 6 }, (_, i) => ({
  id: `answer-${i}`,
  name: `Answer ${i}`,
  prompt: `What is 40 + ${2 + i - i}? Also write answer.txt.`,
  scoring: {
    scorers: [
      { type: 'numeric', expected: 42 },
      { type: 'file_exists', path: 'answer.txt' },
    ],
  },
}));

const usage = {
  inputTokens: 100,
  outputTokens: 20,
  cacheReadTokens: 0,
  totalTokens: 120,
  apiCalls: 1,
  costUsd: 0.001,
  costSource: 'pricing_table' as const,
};

/**
 * Deterministic stand-in for Hermes: "good" answers correctly, "bad" does not,
 * "flaky" hits a provider error on its first attempt, "slow" runs until cancelled.
 */
class FakeRunner implements AgentRunner {
  attempts = new Map<string, number>();

  async run(req: AgentRunRequest): Promise<AgentRunResult> {
    const attempt = (this.attempts.get(req.runId) ?? 0) + 1;
    this.attempts.set(req.runId, attempt);
    const result = (
      status: AgentRunResult['status'],
      finalAnswer: string,
      errorMessage: string | null = null,
    ): AgentRunResult => ({
      status,
      finalAnswer,
      exitCode: status === 'completed' ? 0 : 1,
      errorMessage,
      turnExitReason: null,
      sessionId: 'fake',
      usage,
      durationMs: 5,
      logTail: '',
    });

    if (req.config.id === 'slow') {
      await new Promise<void>((resolve) => {
        if (req.signal.aborted) resolve();
        else req.signal.addEventListener('abort', () => resolve(), { once: true });
      });
      return result('cancelled', '');
    }
    if (req.config.id === 'flaky' && attempt === 1)
      return result('infra_error', '', 'HTTP 429 rate limit');

    const answer = req.config.id === 'bad' ? '41' : '42';
    req.onEvent({
      type: 'tool_call',
      ts: Date.now(),
      toolCallId: 'c1',
      name: 'write_file',
      input: { path: 'answer.txt' },
    });
    await writeFile(join(req.dirs.workspace, 'answer.txt'), answer);
    req.onEvent({
      type: 'tool_result',
      ts: Date.now(),
      toolCallId: 'c1',
      name: 'write_file',
      output: '{}',
      durationMs: 1,
      isError: false,
    });
    req.onEvent({
      type: 'result',
      ts: Date.now(),
      exitCode: 0,
      text: answer,
      durationMs: 5,
      error: null,
    });
    return result('completed', answer);
  }
}

const config = (id: string) => ({
  id,
  name: id.toUpperCase(),
  model: { provider: 'custom', name: 'fake-model' },
  toolsets: ['file'],
});

async function waitFor<T>(
  fn: () => Promise<T>,
  done: (value: T) => boolean,
  timeoutMs = 10_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (done(value)) return value;
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting; last value: ${JSON.stringify(value).slice(0, 500)}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe('experiments API (end to end, fake agent)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const root = await mkdtemp(join(tmpdir(), 'agent-evals-e2e-'));
    const evals = join(root, 'evals');
    await mkdir(join(evals, 'suites'), { recursive: true });
    await mkdir(join(evals, 'configs'), { recursive: true });
    await writeFile(
      join(evals, 'suites', 'mini.yaml'),
      toYaml({ id: 'mini', name: 'Mini', tasks: TASKS }),
    );
    for (const id of ['good', 'bad', 'flaky', 'slow']) {
      await writeFile(join(evals, 'configs', `${id}.yaml`), toYaml(config(id)));
    }
    Object.assign(process.env, {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_PATH: ':memory:',
      DATA_DIR: join(root, 'data'),
      EVALS_DIR: evals,
      WEB_DIST_DIR: join(root, 'no-web'),
      HERMES_BIN: join(root, 'no-hermes'),
      MAX_CONCURRENCY: '4',
      RUN_MAX_ATTEMPTS: '2',
      RUN_RETRY_DELAY_MS: '1',
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AGENT_RUNNER)
      .useValue(new FakeRunner())
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
  });

  async function runExperiment(configIds: string[], trials = 2): Promise<ExperimentDetail> {
    const created = await http
      .post('/api/experiments')
      .send({
        name: `${configIds.join(' vs ')}`,
        suiteId: 'mini',
        configIds,
        trials,
        concurrency: 4,
        seed: 7,
      })
      .expect(201);
    return waitFor(
      async () =>
        (await http.get(`/api/experiments/${created.body.id}`).expect(200))
          .body as ExperimentDetail,
      (e) => e.status === 'completed',
    );
  }

  it('syncs file definitions on boot', async () => {
    const suites = await http.get('/api/suites').expect(200);
    expect(suites.body).toMatchObject([{ id: 'mini', source: 'file', taskCount: 6 }]);
    const configs = await http.get('/api/configs').expect(200);
    expect(configs.body.map((c: { id: string }) => c.id).sort()).toEqual([
      'bad',
      'flaky',
      'good',
      'slow',
    ]);
  });

  it('runs an experiment, scores every run and reports a significant difference', async () => {
    const experiment = await runExperiment(['bad', 'good']);
    expect(experiment.progress).toMatchObject({ total: 24, completed: 24, error: 0 });
    expect(experiment.totalCostUsd).toBeCloseTo(0.024);

    const report = (await http.get(`/api/experiments/${experiment.id}/report`).expect(200))
      .body as ExperimentReport;
    expect(report.baselineConfigId).toBe('bad');
    expect(report.configs.map((c) => c.passRate.value)).toEqual([0, 1]);
    const [comparison] = report.comparisons;
    expect(comparison).toMatchObject({
      candidateConfigId: 'good',
      verdict: 'better',
      pairedTasks: 6,
      wins: 6,
    });
    expect(comparison?.passRate.delta).toBe(1);

    const runs = (await http.get(`/api/experiments/${experiment.id}/runs?configId=bad`).expect(200))
      .body as RunSummary[];
    expect(runs).toHaveLength(12);
    expect(runs.every((r) => r.outcome === 'fail' && r.score === 0.5)).toBe(true);

    const detail = (await http.get(`/api/runs/${runs[0]!.id}`).expect(200)).body as RunDetail;
    expect(detail.events.map((e) => e.type)).toEqual(['tool_call', 'tool_result', 'result']);
    expect(detail.scores).toMatchObject([
      { scorerId: 'numeric-1', passed: false, reason: 'Got 41, expected 42 (off by 1).' },
      { scorerId: 'file_exists-2', passed: true },
    ]);
    expect(detail.files).toEqual([{ path: 'answer.txt', size: 2, created: true, modified: false }]);

    const file = await http
      .get(`/api/runs/${runs[0]!.id}/files`)
      .query({ path: 'answer.txt' })
      .expect(200);
    expect(file.body).toMatchObject({ content: '41', binary: false });
    await http
      .get(`/api/runs/${runs[0]!.id}/files`)
      .query({ path: '../../etc/passwd' })
      .expect(400);
  });

  it('retries infrastructure errors instead of scoring them as failures', async () => {
    const experiment = await runExperiment(['good', 'flaky'], 1);
    expect(experiment.progress).toMatchObject({ total: 12, completed: 12, error: 0 });
    const runs = (
      await http.get(`/api/experiments/${experiment.id}/runs?configId=flaky`).expect(200)
    ).body as RunSummary[];
    expect(runs.every((r) => r.attempt === 2 && r.outcome === 'pass')).toBe(true);
  });

  it('cancels an experiment and its in-flight runs', async () => {
    const created = await http
      .post('/api/experiments')
      .send({ name: 'cancel me', suiteId: 'mini', configIds: ['slow'], trials: 1, concurrency: 2 })
      .expect(201);
    await waitFor(
      async () => (await http.get(`/api/experiments/${created.body.id}`)).body as ExperimentDetail,
      (e) => e.progress.running === 2,
    );
    await http.post(`/api/experiments/${created.body.id}/cancel`).expect(201);
    const final = await waitFor(
      async () => (await http.get(`/api/experiments/${created.body.id}`)).body as ExperimentDetail,
      (e) => e.progress.running === 0,
    );
    expect(final.status).toBe('cancelled');
    expect(final.progress).toMatchObject({ cancelled: 6, queued: 0 });
    await http.post(`/api/experiments/${created.body.id}/cancel`).expect(409);
  });

  it('validates input and protects file-managed definitions', async () => {
    const invalid = await http
      .post('/api/experiments')
      .send({ name: '', suiteId: 'mini', configIds: [] })
      .expect(400);
    expect(invalid.body).toMatchObject({ statusCode: 400, message: 'Validation failed' });
    expect(invalid.body.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['name', 'configIds']),
    );

    await http
      .post('/api/experiments')
      .send({ name: 'x', suiteId: 'nope', configIds: ['good'] })
      .expect(404);
    await http.put('/api/configs/good').send(config('good')).expect(409);

    const yaml = toYaml({ ...config('user-made'), name: 'User made' });
    const created = await http.post('/api/configs').send({ yaml }).expect(201);
    expect(created.body).toMatchObject({ id: 'user-made', source: 'user' });
    await http.post('/api/configs').send({ yaml }).expect(409);
    await http.delete('/api/configs/user-made').expect(204);
  });
});
