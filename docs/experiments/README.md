# Experiments

Real experiments run on this platform with real model calls (Hermes Agent
v0.22.1, models from Ollama Cloud through Ollama on the local machine).

| Experiment                                                                            | Question                                                                                  | Result                                                                              |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Changing the model: gpt-oss 20B → 120B](ANALYSIS.md#experiment-1-changing-the-model) | Does a 6× bigger model pass more core tasks with the same Hermes setup?                   | **No detectable difference**: +5.6 pp (95% range −8.3 to +19.4), p = 0.63           |
| [Memory and skills on/off](ANALYSIS.md#experiment-2-memory-and-skills)                | Do memory and team skills help on tasks that need them, without making other tasks worse? | **Better**: +69.7 pp (95% range +45.5 to +90.9), p = 0.004; control tasks unchanged |

- **[ANALYSIS.md](ANALYSIS.md)** — what the results mean (start here).
- `*.md` — the full generated reports (results per config, per comparison and per task).
- `*.json` — the raw data: the experiment, the report and every run.

## Run it again yourself

```bash
docker compose up --build
```

```bash
curl -s localhost:3000/api/experiments -H 'content-type: application/json' -d '{
  "name": "Model swap: gpt-oss 20B → 120B",
  "suiteId": "core", "configIds": ["gpt-oss-20b", "gpt-oss-120b"],
  "trials": 3, "concurrency": 4, "seed": 2026 }'
```

```bash
node scripts/export-report.mjs <experimentId> docs/experiments
```

The seed fixes the run order and the random steps in the statistics. But
models give different answers each time, so a new run will not match these
results exactly. That is exactly why every comparison uses several tries and
a confidence range.
