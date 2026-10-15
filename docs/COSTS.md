# Approximate costs

All figures come from the real 72-run experiment in
[experiments/](experiments/) (Hermes v0.22.1, file + terminal tools, core
suite of 12 tasks) unless marked as an estimate. Prices are list prices per
million tokens as of October 2026; check your provider before relying on them.

## TL;DR

| Item                                                             | Approximate cost                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| One agent run (core suite, average)                              | **~49k tokens, ~6.7 model calls, ~50 s**                                                                                        |
| …in dollars, by model                                            | $0.002 (gpt-oss-20B) · $0.005 (gpt-oss-120B) · $0.002 (Claude Haiku 5.5) · $0.034 (Claude Sonnet 5.5) · $0.06 (Claude Opus 5.5) |
| A standard experiment: 12 tasks × 2 configs × 3 trials = 72 runs | **$0.15–$0.35** on gpt-oss · **~$2.50** on Sonnet 5.5 · **~$4.30** on Opus 5.5                                                  |
| What we actually paid for the real experiments                   | **$0** (Ollama Cloud free tier); $0.25 at OpenRouter list prices                                                                |
| LLM judge                                                        | < 1% of total (6 judged runs per experiment, ~2k tokens each)                                                                   |
| Platform infrastructure                                          | $0 locally; ~$30–70/month for a 4 vCPU / 8 GB VM if hosted                                                                      |
| Wall-clock                                                       | ~18–25 min for 72 runs on a 4-vCPU laptop (concurrency 4)                                                                       |

## 1. Where the tokens go

Measured over all 72 runs:

|                                          |     gpt-oss 20B |    gpt-oss 120B |
| ---------------------------------------- | --------------: | --------------: |
| Input tokens / run (mean · median)       | 46,857 · 27,156 | 49,798 · 26,844 |
| …served from the provider's prompt cache |             77% |             90% |
| Output tokens / run (mean)               |           1,087 |             900 |
| Model calls / run (mean)                 |             6.8 |             6.6 |
| Tool calls / run (mean)                  |             5.4 |             5.0 |
| Cost / run at the config's list prices   |         $0.0020 |         $0.0049 |
| Cost / **passed** run                    |         $0.0025 |         $0.0055 |

Three things drive cost, in this order:

1. **Context replay.** An agent re-sends its whole conversation on every model
   call: Hermes' system prompt and tool schemas (~4–5k tokens with two
   toolsets) plus every tool result so far. Input tokens therefore grow roughly
   quadratically with the number of steps, and output is only ~2% of tokens.
   Provider-side prompt caching (which Hermes is designed around) is what keeps
   this affordable: 77–90% of input tokens were cache reads.
2. **Tool strategy, more than model choice.** Per-task means range from 6k
   tokens (a word problem, no tools) to 164k (find one line in a 268 KB log).
   The most expensive single run, 448k tokens, paged the log into context with
   `read_file` instead of running `grep`. Tasks with large inputs reward agents
   — and skills — that use the terminal well.
3. **Retries and long tails.** Mean tokens are ~1.8× the median; budget for the
   tail, not the median. Turn limits (`maxTurns`) and the run budget cap it.

## 2. Projected cost of an experiment by model

Using the measured token profile (cache-read share as measured; Anthropic
cache-write surcharges and provider-specific cache behaviour ignored, so treat
these as ±30%):

| Model                          | $ / M input | $ / M cached input | $ / M output | $ / run | 72-run experiment |
| ------------------------------ | ----------: | -----------------: | -----------: | ------: | ----------------: |
| gpt-oss-20B (OpenRouter list)  |        0.04 |               0.04 |         0.16 | $0.0021 |             $0.15 |
| gpt-oss-120B (OpenRouter list) |        0.09 |               0.09 |         0.45 | $0.0048 |             $0.35 |
| Claude Haiku 5.5               |        0.10 |               0.01 |         0.50 | $0.0017 |             $0.12 |
| Claude Sonnet 5.5              |        2.00 |               0.20 |        10.00 |  $0.034 |             $2.45 |
| Claude Opus 5.5                |        4.00 |               0.20 |        20.00 |  $0.060 |             $4.33 |

How cost scales: **runs = tasks × configs × trials**, so cost is linear in
each. A 50-task suite comparing 3 configs with 5 trials is 750 runs: ~$3.60
on gpt-oss-120B, ~$25 on Sonnet 5.5, ~$45 on Opus 5.5 at this token profile.
Harder, longer tasks cost more per run; the core suite is deliberately short.

## 3. LLM judge

Only rubric-graded checks call the judge (one call per judged run, ~1.5k
input + ~200 output tokens). In the core suite that is 1 task of 12 → 6 calls
per 72-run experiment: well under 1% of spend even with a frontier judge
(~$0.03 per experiment at Sonnet 5.5 prices). The sample deployment uses
`gemma4:31b-cloud` — a different model family from the candidates, to avoid
self-preference.

## 4. Infrastructure

| Resource   | Usage                                                                                                                                                                                   | Cost                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Compute    | One container. Each concurrent run is a Hermes process (~120 MB) plus its gateway (~250 MB) while it runs; ~1 GB RSS at concurrency 4. Cold starts are CPU-bound (~5–10 s of one core). | Local: $0. Hosted: a 4 vCPU / 8 GB VM (~$30–70/month) handles concurrency 4–6. |
| Storage    | ~150 KB per run (SQLite rows + trajectory + workspace; Hermes homes are deleted after scoring). 1,000 runs ≈ 150 MB.                                                                    | Negligible.                                                                    |
| Network    | Only model API traffic.                                                                                                                                                                 | —                                                                              |
| Throughput | ~3–5 runs/minute on 4 vCPUs at concurrency 4 for these tasks; bounded by provider latency and serialised Hermes cold starts.                                                            | Wall-clock is usually the binding constraint, not dollars.                     |

## 5. Keeping costs down

- **Add tasks before trials.** The task is the unit of analysis: more tasks
  narrow intervals more than more trials (§6 of DESIGN). 3 trials is a good
  default for measuring flakiness.
- **Pin a cheap judge** and use deterministic checks wherever possible.
- **Keep prompt caching effective:** don't vary the system prompt between runs
  of a config (the platform pins everything not under test).
- **Watch the expensive tasks** in the per-task token view; a skill that
  teaches "grep, don't read" is a cheap fix for log-heavy work.
- **Interleave and cap:** concurrency limits protect provider rate limits;
  retries back off instead of hammering.
- Not yet built: a pre-flight cost estimate and per-experiment budget cap
  (see [LIMITATIONS.md](LIMITATIONS.md)).
