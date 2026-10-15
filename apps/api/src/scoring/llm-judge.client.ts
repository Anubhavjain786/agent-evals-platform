import { setTimeout as sleep } from 'node:timers/promises';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';

export interface JudgeVerdict {
  /** 0–10 as returned by the judge. */
  score: number;
  reasoning: string;
  model: string;
  raw: string;
}

export class JudgeUnavailableError extends Error {}

const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

const SYSTEM_PROMPT = `You are a strict, impartial grader for AI agent outputs.
Grade ONLY against the rubric. Do not reward length, confidence or style the rubric does not ask for.
Respond with a single JSON object and nothing else:
{"reasoning": "<2-4 sentences citing the evidence>", "score": <integer 0-10>}`;

/** Extracts the verdict JSON even when the model wraps it in prose or a code fence. */
export function parseVerdict(content: string): { score: number; reasoning: string } | null {
  const candidates = [
    content,
    /```(?:json)?\s*([\s\S]*?)```/.exec(content)?.[1],
    /\{[\s\S]*\}/.exec(content)?.[0],
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as { score?: unknown; reasoning?: unknown };
      const score = Number(parsed.score);
      if (Number.isFinite(score) && score >= 0 && score <= 10) {
        return { score, reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '' };
      }
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

/** Minimal OpenAI-compatible chat client for LLM-as-judge scoring (temperature 0, retries). */
@Injectable()
export class LlmJudgeClient {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get configured(): boolean {
    return !!(this.config.judge.baseUrl && this.config.judge.model);
  }

  async grade(input: {
    rubric: string;
    taskPrompt: string;
    candidate: string;
    signal: AbortSignal;
  }): Promise<JudgeVerdict> {
    const { baseUrl, model, apiKey, timeoutMs } = this.config.judge;
    if (!baseUrl || !model) {
      throw new JudgeUnavailableError(
        'LLM judge is not configured (set JUDGE_BASE_URL and JUDGE_MODEL)',
      );
    }
    const userPrompt = [
      `## Task given to the agent\n${input.taskPrompt}`,
      `## Rubric\n${input.rubric}`,
      `## Agent output to grade\n${input.candidate || '(empty)'}`,
    ].join('\n\n');

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
          }),
          signal: AbortSignal.any([input.signal, AbortSignal.timeout(timeoutMs)]),
        });
        if (!response.ok) {
          const body = await response.text();
          if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_ATTEMPTS) {
            lastError = new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
            await sleep(1000 * 2 ** attempt);
            continue;
          }
          throw new JudgeUnavailableError(
            `Judge returned HTTP ${response.status}: ${body.slice(0, 300)}`,
          );
        }
        const payload = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const raw = payload.choices?.[0]?.message?.content ?? '';
        const verdict = parseVerdict(raw);
        if (!verdict)
          throw new JudgeUnavailableError(
            `Judge response was not a valid verdict: ${raw.slice(0, 300)}`,
          );
        return { ...verdict, model, raw };
      } catch (error) {
        if (error instanceof JudgeUnavailableError || input.signal.aborted) throw error;
        lastError = error;
        if (attempt < MAX_ATTEMPTS) await sleep(1000 * 2 ** attempt);
      }
    }
    throw new JudgeUnavailableError(
      `Judge request failed: ${(lastError as Error)?.message ?? 'unknown error'}`,
    );
  }
}
