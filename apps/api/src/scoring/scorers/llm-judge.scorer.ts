import type { ScorerOf } from '@agent-evals/shared';
import { Injectable } from '@nestjs/common';
import { LlmJudgeClient } from '../llm-judge.client';
import { describeTarget, type ScoreContext, type Scorer, type ScorerOutcome } from '../scorer';

const MAX_CANDIDATE_CHARS = 20_000;

/**
 * Rubric-based grading by an LLM, for qualities string checks cannot capture.
 * Use sparingly: judges are slower, cost money and carry their own biases, so
 * the sample suite pairs them with deterministic checks.
 */
@Injectable()
export class LlmJudgeScorer implements Scorer<'llm_judge'> {
  readonly type = 'llm_judge' as const;

  constructor(private readonly judge: LlmJudgeClient) {}

  async score(def: ScorerOf<'llm_judge'>, ctx: ScoreContext): Promise<ScorerOutcome> {
    const text = await ctx.readTarget(def.target);
    if (text === null) {
      return {
        score: 0,
        passed: false,
        reason: `The ${describeTarget(def.target)} does not exist.`,
      };
    }
    const verdict = await this.judge.grade({
      rubric: def.rubric,
      taskPrompt: ctx.task.prompt,
      candidate: text.slice(0, MAX_CANDIDATE_CHARS),
      signal: ctx.signal,
    });
    const score = verdict.score / 10;
    const passed = score >= def.passThreshold;
    return {
      score,
      passed,
      reason: `Judge scored ${verdict.score}/10 (pass ≥ ${Math.round(def.passThreshold * 10)}): ${verdict.reasoning}`,
      evidence: { judgeModel: verdict.model, judgeScore: verdict.score, raw: verdict.raw },
    };
  }
}
