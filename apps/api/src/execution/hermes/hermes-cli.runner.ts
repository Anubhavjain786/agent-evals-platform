import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { SkillsLibraryService } from '../../definitions/skills-library.service';
import type { AgentRunner, AgentRunRequest, AgentRunResult } from '../agent-runner';
import { TailBuffer, runManagedProcess } from '../process';
import { cleanFinalAnswer } from './final-answer';
import { buildHermesArgs, materializeHermesHome } from './hermes-home';
import { HermesStreamParser } from './stream-parser';
import { classifyOutcome, type HermesUsageReport, toRunUsage } from './usage';

/** Environment passed through to Hermes. Everything else — including other secrets — is withheld. */
const PASSTHROUGH_EXACT = new Set([
  'PATH',
  'LANG',
  'LC_ALL',
  'TZ',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'REQUESTS_CA_BUNDLE',
]);
const PASSTHROUGH_PREFIXES = ['HERMES_', 'PYTHON', 'PLAYWRIGHT_'];
/** Hermes keeps running a little past its own run budget to wrap up; then we hard-kill. */
const HARD_KILL_GRACE_MS = 30_000;
const LOG_TAIL_BYTES = 8_192;

/**
 * Runs one task with the Hermes CLI (`hermes chat --oneshot --format
 * stream-json`) — Hermes' documented programmatic interface — in a fresh
 * process with its own HERMES_HOME, working directory and write sandbox.
 */
@Injectable()
export class HermesCliRunner implements AgentRunner {
  private readonly logger = new Logger(HermesCliRunner.name);

  constructor(
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
    private readonly skills: SkillsLibraryService,
  ) {}

  async run(request: AgentRunRequest): Promise<AgentRunResult> {
    const { dirs, config, task } = request;
    const promptFile = join(dirs.root, 'prompt.txt');
    const usageFile = join(dirs.root, 'usage.json');

    await materializeHermesHome({
      home: dirs.home,
      config,
      maxTurns: request.maxTurns,
      env: process.env,
      skillDir: (id) => this.skills.skillDir(id),
    });
    await writeFile(promptFile, task.prompt, { mode: 0o600 });

    const runBudgetSec = Math.max(30, Math.floor(request.timeoutMs / 1000));
    const args = buildHermesArgs({
      config,
      promptFile,
      usageFile,
      maxTurns: request.maxTurns,
      runBudgetSec,
    });

    const parser = new HermesStreamParser(request.onEvent);
    const stderr = new TailBuffer(LOG_TAIL_BYTES);
    const startedAt = Date.now();
    const processResult = await runManagedProcess({
      command: this.appConfig.hermesBin,
      args,
      cwd: dirs.workspace,
      env: this.buildEnv(request),
      timeoutMs: request.timeoutMs + HARD_KILL_GRACE_MS,
      signal: request.signal,
      onStdout: (chunk) => parser.push(chunk),
      onStderr: (chunk) => stderr.push(chunk),
    });
    parser.end();
    const durationMs = Date.now() - startedAt;

    if (processResult.spawnError) {
      this.logger.error(`Failed to start Hermes: ${processResult.spawnError.message}`);
    }
    if (parser.malformed > 0) {
      this.logger.warn(`Run ${request.runId}: ignored ${parser.malformed} malformed stream lines`);
    }

    const report = await this.readUsage(usageFile);
    const result = parser.result;
    const { status, errorMessage } = classifyOutcome({
      result,
      report,
      timedOut: processResult.timedOut,
      cancelled: processResult.cancelled,
    });

    return {
      status,
      finalAnswer: cleanFinalAnswer(result?.text ?? ''),
      exitCode: result?.exitCode ?? processResult.exitCode,
      errorMessage: processResult.spawnError
        ? `Could not start Hermes (${this.appConfig.hermesBin}): ${processResult.spawnError.message}`
        : errorMessage,
      turnExitReason: report?.turn_exit_reason ?? null,
      sessionId: result?.sessionId || report?.session_id || null,
      usage: toRunUsage(report, result, config.model.pricing),
      durationMs,
      logTail: stderr.toString(),
    };
  }

  private buildEnv(request: AgentRunRequest): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (PASSTHROUGH_EXACT.has(key) || PASSTHROUGH_PREFIXES.some((p) => key.startsWith(p))) {
        env[key] = value;
      }
    }
    const { dirs, config } = request;
    // Only the key this config needs is exposed to the agent process.
    const keyName = config.model.apiKeyEnv;
    if (keyName && process.env[keyName]) env[keyName] = process.env[keyName];

    return {
      ...env,
      HOME: dirs.root,
      HERMES_HOME: dirs.home,
      // Hard-blocks write_file/patch outside the workspace.
      HERMES_WRITE_SAFE_ROOT: dirs.workspace,
      XDG_RUNTIME_DIR: dirs.runtime,
      PYTHONUNBUFFERED: '1',
    };
  }

  private async readUsage(path: string): Promise<HermesUsageReport | null> {
    try {
      return JSON.parse(await readFile(path, 'utf8')) as HermesUsageReport;
    } catch {
      return null;
    }
  }
}
