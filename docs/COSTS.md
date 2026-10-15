# Approximate costs

All numbers here come from the real 72-run experiment in
[experiments/](experiments/) (Hermes v0.22.1, file and terminal tools, the core
suite of 12 tasks), unless a line says it is an estimate. Prices are list
prices per million tokens in October 2026. Check your provider's current
prices before relying on them.

## Summary

| Item                                                          | Approximate cost                                                                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| One agent run (core suite, average)                           | **about 49,000 tokens, 6.7 model calls, 50 seconds**                                                                            |
| One run in dollars, by model                                  | $0.002 (gpt-oss-20B) · $0.005 (gpt-oss-120B) · $0.002 (Claude Haiku 5.5) · $0.034 (Claude Sonnet 5.5) · $0.06 (Claude Opus 5.5) |
| A normal experiment: 12 tasks × 2 configs × 3 tries = 72 runs | **$0.15–$0.35** with gpt-oss · **about $2.50** with Sonnet 5.5 · **about $4.30** with Opus 5.5                                  |
| What we actually paid for our two real experiments            | **$0** (Ollama Cloud free tier). At OpenRouter prices the first one would cost $0.25.                                           |
| LLM judge                                                     | less than 1% of the total (6 judged runs per experiment, about 2,000 tokens each)                                               |
| Servers                                                       | $0 on your own computer; about $30–70 per month for a 4-CPU / 8 GB cloud server                                                 |
| Time                                                          | about 18–25 minutes for 72 runs on a 4-CPU laptop (4 runs at a time)                                                            |

## 1. Where the tokens go

Measured over all 72 runs:

|                                               |     gpt-oss 20B |    gpt-oss 120B |
| --------------------------------------------- | --------------: | --------------: |
| Input tokens per run (average · middle value) | 46,857 · 27,156 | 49,798 · 26,844 |
| …of which came from the provider's cache      |             77% |             90% |
| Output tokens per run (average)               |           1,087 |             900 |
| Model calls per run (average)                 |             6.8 |             6.6 |
| Tool calls per run (average)                  |             5.4 |             5.0 |
| Cost per run at the config's prices           |         $0.0020 |         $0.0049 |
| Cost per **passed** run                       |         $0.0025 |         $0.0055 |

Three things decide the cost, most important first:

1. **The conversation is sent again on every call.** On every model call, the
   agent sends the whole conversation so far: Hermes' instructions and tool
   descriptions (about 4,000–5,000 tokens with two toolsets) plus every tool
   result until now. So input grows quickly with each step, and output is only
   about 2% of all tokens. The provider's prompt cache makes this cheap: 77–90%
   of input tokens were read from the cache, which costs much less.
2. **How the agent uses tools matters more than which model it is.** Per task,
   the average goes from 6,000 tokens (a word problem, no tools) to 164,000
   (find one line in a 268 KB log file). The most expensive single run used
   448,000 tokens because the agent read the whole log into the conversation
   with `read_file` instead of searching it with `grep`. Agents (and skills)
   that use the terminal well are much cheaper on big files.
3. **A few runs are much more expensive than most.** The average is about 1.8
   times the middle value. Plan for the expensive runs, not the typical one.
   The turn limit (`maxTurns`) and the time limit keep them in check.

## 2. Estimated cost of an experiment, by model

These use the measured token numbers above. They ignore some provider details
(for example, Anthropic charges a bit extra to write to the cache), so treat
them as ±30%.

| Model                           | $ per M input | $ per M cached input | $ per M output | $ per run | 72-run experiment |
| ------------------------------- | ------------: | -------------------: | -------------: | --------: | ----------------: |
| gpt-oss-20B (OpenRouter price)  |          0.04 |                 0.04 |           0.16 |   $0.0021 |             $0.15 |
| gpt-oss-120B (OpenRouter price) |          0.09 |                 0.09 |           0.45 |   $0.0048 |             $0.35 |
| Claude Haiku 5.5                |          0.10 |                 0.01 |           0.50 |   $0.0017 |             $0.12 |
| Claude Sonnet 5.5               |          2.00 |                 0.20 |          10.00 |    $0.034 |             $2.45 |
| Claude Opus 5.5                 |          4.00 |                 0.20 |          20.00 |    $0.060 |             $4.33 |

**How cost grows:** number of runs = tasks × configs × tries, and cost grows
in a straight line with each of these. For example, 50 tasks, 3 configs and 5
tries is 750 runs: about $3.60 with gpt-oss-120B, $25 with Sonnet 5.5, or $45
with Opus 5.5. Harder and longer tasks cost more per run; the core suite is
kept short on purpose.

## 3. LLM judge

Only checks of type `llm_judge` call the judge: one call per judged run, about
1,500 input and 200 output tokens. In the core suite only 1 of the 12 tasks
uses it, so that is 6 calls per 72-run experiment. That is well under 1% of the
cost, even with an expensive judge (about $0.03 per experiment at Sonnet 5.5
prices). The sample setup uses `gemma4:31b-cloud`, a different model family
from the models being tested, so the judge does not favour itself.

## 4. Servers and storage

| Resource | Usage                                                                                                                                                                                                   | Cost                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Compute  | One container. While a run is active it uses a Hermes process (about 120 MB) and its gateway (about 250 MB), so about 1 GB with 4 runs at a time. Each Hermes start uses one CPU core for 5–10 seconds. | Your own computer: $0. Cloud: a 4-CPU / 8 GB server (about $30–70 a month) handles 4–6 runs at a time. |
| Storage  | About 150 KB per run (database rows, steps and files; the Hermes setup is deleted after checking). 1,000 runs is about 150 MB.                                                                          | Almost nothing.                                                                                        |
| Network  | Only calls to the model provider.                                                                                                                                                                       | —                                                                                                      |
| Speed    | About 3–5 runs per minute on 4 CPUs with 4 runs at a time, for these tasks. The limits are the provider's speed and Hermes start-up (one start at a time).                                              | Time is usually the real limit, not money.                                                             |

## 5. How to keep costs down

- **Add tasks before adding tries.** Tasks are what the statistics count (see
  DESIGN §6), so more tasks narrow the confidence range faster than more tries.
  3 tries is a good default for spotting flaky tasks.
- **Use a cheap judge**, and use rule-based checks wherever you can.
- **Keep the provider's cache working:** do not change the agent's instructions
  between runs of the same config (the platform already fixes everything that
  is not being tested).
- **Watch the expensive tasks** in the per-task numbers. A skill that says
  "search with grep, don't read the whole file" is a cheap fix for log-heavy
  tasks.
- **Limit and spread out runs:** the concurrency limit protects you from
  provider rate limits, and retries wait longer each time instead of hammering
  the provider.
- Not built yet: a cost estimate before starting, and a budget limit per
  experiment (see [LIMITATIONS.md](LIMITATIONS.md)).
