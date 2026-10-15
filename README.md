# Agent Evals Platform

Answer one question with evidence: **when we change the model, add a skill or
turn on memory, did the agent get better, worse, or stay the same — and how
sure can we be?**

The platform runs a suite of tasks against two or more configurations of
[Hermes Agent](https://github.com/NousResearch/hermes-agent), several times
each, scores every run with deterministic checks (and an LLM judge where
strings cannot decide), and reports the difference with confidence intervals,
a multiplicity-corrected p-value and the smallest effect the experiment could
have detected. Every run can be opened to see exactly why it passed or failed.

**Stack:** NestJS 11 · Vue 3 · TypeScript throughout · SQLite (Drizzle) · Hermes
Agent v0.22.1 · Docker

| Deliverable                                                | Where                                      |
| ---------------------------------------------------------- | ------------------------------------------ |
| Source code + README                                       | this repository                            |
| Design document (architecture, key decisions, assumptions) | [docs/DESIGN.md](docs/DESIGN.md)           |
| Known limits                                               | [docs/LIMITATIONS.md](docs/LIMITATIONS.md) |
| Approximate costs                                          | [docs/COSTS.md](docs/COSTS.md)             |
| Results of a real experiment                               | [docs/experiments/](docs/experiments/)     |
| Video of the working system                                | see [docs/VIDEO.md](docs/VIDEO.md)         |

---

## Quick start

**Prerequisites:** Docker (Docker Desktop on macOS/Windows) and a model
endpoint. The sample configs use [Ollama](https://ollama.com) on your machine,
which can serve Ollama Cloud models without local GPUs:

```bash
ollama signin
```

```bash
ollama pull gpt-oss:20b-cloud && ollama pull gpt-oss:120b-cloud && ollama pull gemma4:31b-cloud
```

(Prefer a hosted API? Put `OPENROUTER_API_KEY=…` in `.env` and use the
`claude-sonnet-openrouter` config, or add your own config in the UI.)

**Run it — one command:**

```bash
docker compose up --build
```

Open <http://localhost:3000>. The header shows the detected Hermes version.

**Run your first experiment:** _Experiments → New experiment_, pick the
**Core agent tasks** suite, select `gpt-oss 20B` then `gpt-oss 120B` (the first
selected is the baseline), keep 3 trials and start. Progress streams live; the
verdict, intervals and per-task heatmap fill in as runs finish. Click any
heatmap cell or run to see its checks, trajectory and workspace.

Or from the shell:

```bash
curl -s localhost:3000/api/experiments -H 'content-type: application/json' \
  -d '{"name":"20B vs 120B","suiteId":"core","configIds":["gpt-oss-20b","gpt-oss-120b"],"trials":3}'
```

Export a finished experiment as Markdown + JSON:

```bash
node scripts/export-report.mjs <experimentId> docs/experiments
```

## What's inside

```
apps/
  api/                NestJS backend
    src/definitions/  YAML → DB sync, suites/configs/skills CRUD, catalog
    src/experiments/  experiment lifecycle, runs, reports, SSE
    src/execution/    durable scheduler, run executor, Hermes CLI runner, workspaces
    src/scoring/      nine scorer strategies + LLM judge client
    src/analysis/     statistics (pure) + report builder
    drizzle/          SQL migrations
  web/                Vue 3 SPA (Vite, Vue Router, TanStack Query, Tailwind)
packages/shared/      zod schemas + API types shared by api and web
evals/
  suites/             core.yaml (12 tasks), harness.yaml (memory/skills, 6 tasks)
  configs/            agent configurations
  skills/             Hermes skills that configs can opt into
  fixtures/           task workspaces and hidden graders
scripts/              fixture generator, report exporter
docs/                 design, limits, costs, experiment results
```

## How it works (short version)

1. **Definitions as code.** Suites, configs and skills live in `evals/` as
   YAML and are synced into SQLite on boot, versioned by content hash. Suites
   and configs can also be created in the UI.
2. **Experiment = suite × configs × trials.** Launching one freezes a snapshot
   of every definition and plans every run in a seeded random order, so
   provider hiccups hit all configs alike.
3. **Each run is isolated.** A fresh `HERMES_HOME` (generated `config.yaml`,
   seeded memory, only the opted-in skills), a workspace seeded from fixtures
   with Hermes' write sandbox pointed at it, and a minimal environment. Hermes
   runs through its documented one-shot `stream-json` CLI; the trajectory and
   usage are captured.
4. **Scoring grades the end state:** final answer, files, hidden tests copied
   in after the agent finished, tool usage, and an LLM judge for rubrics.
5. **Analysis is paired and task-clustered:** two-level bootstrap intervals,
   an exact sign-flip permutation test, Holm correction across configs, and
   the minimum detectable effect. Infrastructure errors are retried and
   excluded, never counted as agent failures.

Details and trade-offs: [docs/DESIGN.md](docs/DESIGN.md).

## Defining tasks

```yaml
# evals/suites/my-suite.yaml
id: my-suite
name: My suite
tasks:
  - id: fix-pricing-bug
    name: Fix the pricing bug
    tags: [coding]
    fixtures: pricing # copied from evals/fixtures/pricing into the workspace
    prompt: The tests in test_pricing.py fail. Fix pricing.py without changing the tests.
    limits: { timeoutSec: 300, maxTurns: 20 }
    scoring:
      # passThreshold: 0.75   # optional partial credit; default = every check must pass
      scorers:
        - { type: command, run: python3 -m unittest -q test_pricing }
        - type: command
          run: python3 -m unittest -q test_pricing_hidden
          hiddenFixtures: pricing-hidden # copied in only after the agent finished
          weight: 2
```

| Scorer        | Passes when                                                                  |
| ------------- | ---------------------------------------------------------------------------- |
| `contains`    | the answer/file contains all (or any) values; `negate: true` = contains none |
| `exact_match` | normalised answer equals `expected`                                          |
| `regex`       | the target matches `pattern`                                                 |
| `numeric`     | the last (or first) number is within `tolerance` of `expected`               |
| `json_field`  | the JSON value at `path` equals `expected` (numeric tolerance supported)     |
| `file_exists` | a workspace file exists (or not, with `shouldExist: false`)                  |
| `command`     | a shell command in the workspace exits with `expectExitCode`                 |
| `tool_usage`  | a tool was called between `min` and `max` times                              |
| `llm_judge`   | the judge model scores the target ≥ `passThreshold` against `rubric`         |

Every scorer accepts `id`, `description`, `weight` and `required`. Text
scorers take a `target`: `final_answer` (default) or `file:<path>`.

## Defining agent configs

```yaml
# evals/configs/gpt-oss-120b-memory-skills.yaml
id: gpt-oss-120b-memory-skills
name: gpt-oss 120B · +memory +skills
model:
  provider: custom # any Hermes provider: custom, openrouter, anthropic, …
  name: gpt-oss:120b-cloud
  baseUrl: ${OLLAMA_BASE_URL:-http://localhost:11434/v1}
  pricing: { inputPerMTok: 0.09, outputPerMTok: 0.45 } # for cost when Hermes can't price it
  # apiKeyEnv: OPENROUTER_API_KEY   # the env var NAME; secrets never live in definitions
toolsets: [file, terminal, skills, memory]
skills:
  include: [acme-invoice-ids, release-notes-format] # from evals/skills
memory:
  enabled: true
  notes: ['Staging Postgres is db-staging.internal.acme.example:6543.']
maxTurns: 20
```

Change one variable per config to attribute a difference to it.

## API

All endpoints are under `/api`; errors are `{ statusCode, error, message, details? }`.

| Method & path                                                        | Purpose                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `GET /health`                                                        | status, Hermes version, active runs                                      |
| `GET /catalog`                                                       | toolsets, skills, scorer types, Hermes version                           |
| `GET/POST /suites`, `GET/PUT/DELETE /suites/:id`                     | suites (JSON or `{ "yaml": "…" }`; file-managed suites are read-only)    |
| `GET/POST /configs`, `GET/PUT/DELETE /configs/:id`                   | agent configs (same rules)                                               |
| `GET/POST /experiments`, `GET/DELETE /experiments/:id`               | experiments                                                              |
| `POST /experiments/:id/cancel`, `POST /experiments/:id/retry`        | cancel; re-queue errored/cancelled runs                                  |
| `GET /experiments/:id/report`                                        | statistics: per-config estimates, comparisons, per-task matrix, warnings |
| `GET /experiments/:id/runs?configId&taskId&status&outcome`           | runs                                                                     |
| `GET /experiments/:id/stream`                                        | Server-Sent Events: progress and run updates                             |
| `GET /runs/:id`, `GET /runs/:id/files?path=`, `GET /runs/:id/stream` | run detail, workspace files, live trajectory                             |

## Configuration

Environment variables (all optional; see [.env.example](.env.example)):

| Variable                                           | Default                                          | Purpose                                   |
| -------------------------------------------------- | ------------------------------------------------ | ----------------------------------------- |
| `PORT`                                             | `3000`                                           | HTTP port                                 |
| `DATA_DIR`                                         | `./data` (`/data` in Docker)                     | SQLite database and run directories       |
| `EVALS_DIR`                                        | `./evals`                                        | definitions root                          |
| `HERMES_BIN`                                       | `hermes`                                         | Hermes CLI (set by the image)             |
| `MAX_CONCURRENCY`                                  | `4`                                              | runs in flight across experiments         |
| `RUN_MAX_ATTEMPTS` / `RUN_RETRY_DELAY_MS`          | `3` / `5000`                                     | retries for infrastructure errors         |
| `KEEP_RUN_HOME`                                    | `false`                                          | keep each run's Hermes home for debugging |
| `OLLAMA_BASE_URL`                                  | `http://host.docker.internal:11434/v1` in Docker | used by the sample configs                |
| `JUDGE_BASE_URL` / `JUDGE_MODEL` / `JUDGE_API_KEY` | Ollama + `gemma4:31b-cloud` in Docker            | LLM judge endpoint                        |
| `LOG_LEVEL`                                        | `info`                                           | pino log level                            |

## Development

Requires Node 22+ and npm 11 (`npm i -g npm@11` — npm 10 hits a resolver bug
with this dependency graph). Running real experiments outside Docker also
requires the Hermes CLI on your `PATH` (or `HERMES_BIN`).

```bash
npm ci
```

```bash
npm run dev        # shared (watch) + API on :3000 + web on :5173 with /api proxy
```

```bash
npm run check      # prettier, eslint, typecheck and tests across all workspaces
```

Tests (Vitest): the statistics, report builder, scorers, Hermes stream
parsing/outcome classification/home generation, process reaping, the run
planner, schema rules, UI formatting and badges, and an end-to-end API test
that boots the whole Nest app on an in-memory database with a fake agent to
cover create → run → score → report, retries, cancellation and validation.

Regenerate data fixtures (deterministic) with `python3 scripts/generate-fixtures.py`.
