# Experiments

Real experiments run on this platform with real model calls (Hermes Agent
v0.22.1, models served by Ollama Cloud through a local Ollama daemon).

| Experiment                                                            | Question                                                                                             | Verdict                                                                     |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [Model swap: gpt-oss 20B → 120B](ANALYSIS.md#experiment-1-model-swap) | Does a 6× larger model pass more core tasks on the same harness?                                     | **No detectable difference**: +5.6 pp (95% CI −8.3 to +19.4), p = 0.63      |
| [Memory & skills on/off](ANALYSIS.md#experiment-2-memory--skills)     | Do persistent memory and team skills improve tasks that depend on them, without regressing controls? | **Better**: +69.7 pp (95% CI +45.5 to +90.9), p = 0.004; controls unchanged |

- **[ANALYSIS.md](ANALYSIS.md)** — interpretation of the results (start here).
- `*.md` — full generated reports (per-config, per-comparison and per-task tables).
- `*.json` — raw export: experiment, report and every run summary.

## Reproduce

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

The seed fixes the run order and the statistics' resampling. Model outputs are
stochastic, so a re-run will not reproduce run-level results exactly — which is
precisely why every comparison is made on several trials with intervals.
