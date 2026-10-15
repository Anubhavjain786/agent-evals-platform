import type { ScorerOf } from '@agent-evals/shared';
import { Injectable } from '@nestjs/common';
import { runManagedProcess, TailBuffer } from '../../execution/process';
import type { ScoreContext, Scorer, ScorerOutcome } from '../scorer';

@Injectable()
export class FileExistsScorer implements Scorer<'file_exists'> {
  readonly type = 'file_exists' as const;

  async score(def: ScorerOf<'file_exists'>, ctx: ScoreContext): Promise<ScorerOutcome> {
    const exists = await ctx.readTarget(`file:${def.path}`).then((text) => text !== null);
    const passed = exists === def.shouldExist;
    return {
      score: passed ? 1 : 0,
      passed,
      reason: `${def.path} ${exists ? 'exists' : 'does not exist'}${passed ? '' : ` (expected it ${def.shouldExist ? 'to exist' : 'to be absent'})`}.`,
      evidence: { path: def.path, exists },
    };
  }
}

/**
 * Runs a grading command (typically hidden tests) in the workspace after the
 * agent finished. Commands come from task definitions, which are trusted code
 * reviewed like any other code in the repository.
 */
@Injectable()
export class CommandScorer implements Scorer<'command'> {
  readonly type = 'command' as const;

  async score(def: ScorerOf<'command'>, ctx: ScoreContext): Promise<ScorerOutcome> {
    if (def.hiddenFixtures) await ctx.addHiddenFixtures(def.hiddenFixtures);

    const stdout = new TailBuffer(4_000);
    const stderr = new TailBuffer(4_000);
    const result = await runManagedProcess({
      command: '/bin/sh',
      args: ['-c', def.run],
      cwd: ctx.workspaceDir,
      env: {
        PATH: process.env.PATH,
        LANG: process.env.LANG ?? 'C.UTF-8',
        HOME: ctx.workspaceDir,
        PYTHONDONTWRITEBYTECODE: '1',
      },
      timeoutMs: def.timeoutSec * 1000,
      signal: ctx.signal,
      onStdout: (chunk) => stdout.push(chunk),
      onStderr: (chunk) => stderr.push(chunk),
    });

    const evidence = {
      command: def.run,
      exitCode: result.exitCode,
      stdout: stdout.toString(),
      stderr: stderr.toString(),
    };
    if (result.spawnError) {
      return {
        score: 0,
        passed: false,
        reason: `Could not run "${def.run}": ${result.spawnError.message}`,
        evidence,
      };
    }
    if (result.timedOut) {
      return {
        score: 0,
        passed: false,
        reason: `"${def.run}" timed out after ${def.timeoutSec}s.`,
        evidence,
      };
    }
    const passed = result.exitCode === def.expectExitCode;
    return {
      score: passed ? 1 : 0,
      passed,
      reason: passed
        ? `"${def.run}" exited with ${result.exitCode} as expected.`
        : `"${def.run}" exited with ${result.exitCode ?? result.signal}, expected ${def.expectExitCode}.`,
      evidence,
    };
  }
}

@Injectable()
export class ToolUsageScorer implements Scorer<'tool_usage'> {
  readonly type = 'tool_usage' as const;

  async score(def: ScorerOf<'tool_usage'>, ctx: ScoreContext): Promise<ScorerOutcome> {
    const calls = ctx.events.filter((e) => e.type === 'tool_call' && e.name === def.tool).length;
    const tooFew = def.min !== undefined && calls < def.min;
    const tooMany = def.max !== undefined && calls > def.max;
    const passed = !tooFew && !tooMany;
    const bounds = [
      def.min !== undefined ? `at least ${def.min}` : null,
      def.max !== undefined ? `at most ${def.max}` : null,
    ]
      .filter(Boolean)
      .join(' and ');
    return {
      score: passed ? 1 : 0,
      passed,
      reason: `${def.tool} was called ${calls} time(s)${bounds ? `; expected ${bounds}` : ''}.`,
      evidence: { tool: def.tool, calls },
    };
  }
}
