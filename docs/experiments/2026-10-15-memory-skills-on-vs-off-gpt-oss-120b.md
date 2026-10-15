# Memory & skills on vs off (gpt-oss 120B)

> Hypothesis: enabling Hermes persistent memory (seeded with facts from earlier sessions) and the team skills improves the tasks that depend on them, without regressing the control tasks. The model and every other setting are held constant.

- **Suite:** Memory & skills tasks (`harness@be14b9f932d1`), 11 tasks
- **Design:** 11 tasks × 2 configs × 3 trials = 66 runs, interleaved in seeded random order (seed 2026)
- **Status:** completed — 66 scored, 0 infrastructure errors, 0 cancelled
- **Ran:** 2026-10-15T07:35:02.235Z → 2026-10-15T08:03:49.174Z
- **Spend (list-price equivalent):** $0.15

## Configurations

|           | Config                         | Model                       | Toolsets                       | Skills                                                    | Memory | Version        |
| --------- | ------------------------------ | --------------------------- | ------------------------------ | --------------------------------------------------------- | ------ | -------------- |
| baseline  | gpt-oss 120B · file+terminal   | `custom/gpt-oss:120b-cloud` | file, terminal                 | —                                                         | off    | `3146acb320ae` |
| candidate | gpt-oss 120B · +memory +skills | `custom/gpt-oss:120b-cloud` | file, terminal, skills, memory | acme-invoice-ids, release-notes-format, incident-severity | on     | `6bc777b1b466` |

## Verdict

**BETTER** — gpt-oss 120B · +memory +skills is better than gpt-oss 120B · file+terminal: +69.7 pp pass rate (95% CI +45.5 pp to +90.9 pp; p = 0.004, Holm-adjusted, n = 11 tasks).

| Metric     | Baseline | Candidate | Δ (candidate − baseline) | 95% CI               | p (Holm) |
| ---------- | -------: | --------: | -----------------------: | -------------------- | -------: |
| Pass rate  |    18.2% |     87.9% |                 +69.7 pp | +45.5 pp to +90.9 pp |    0.004 |
| Mean score |    41.8% |     87.9% |                 +46.0 pp | +22.8 pp to +68.9 pp |    0.004 |

Tasks won / lost / tied by the candidate: **9 / 0 / 2** (of 11 paired). Minimum detectable pass-rate effect at 80% power: ±34 pp.

## Per-config results

| Config                         | Pass rate (95% CI) | Mean score (95% CI) | Scored runs | Infra errors | Cost / run | Cost / pass | Latency mean (p95) | Tokens / run | Tool calls / run |
| ------------------------------ | ------------------ | ------------------- | ----------: | -----------: | ---------: | ----------: | -----------------: | -----------: | ---------------: |
| gpt-oss 120B · file+terminal   | 18.2% (0%–45%)     | 41.8% (21%–64%)     |          33 |            0 |    $0.0027 |       $0.01 |    38.3 s (72.9 s) |       27,040 |              4.2 |
| gpt-oss 120B · +memory +skills | 87.9% (73%–100%)   | 87.9% (70%–100%)    |          33 |            0 |    $0.0019 |     $0.0022 |    30.6 s (55.6 s) |       19,881 |              1.9 |

## Per-task results

Passes / scored runs per config. ⚠ = flaky (passed on some trials, failed on others).

| Task                                           | Tags               | gpt-oss 120B · file+terminal | gpt-oss 120B · +memory +skills |
| ---------------------------------------------- | ------------------ | :--------------------------: | :----------------------------: |
| Customer notice in house style                 | memory, writing    |             0/3              |              3/3               |
| Staging database URL from project context      | memory, tools      |             0/3              |              3/3               |
| Answer in the user's preferred units           | memory, reasoning  |             0/3              |              3/3               |
| Commit message following the team convention ⚠ | memory, coding     |             0/3              |              2/3               |
| Terraform provider for the production region   | memory, coding     |             0/3              |              3/3               |
| Validate ACME invoice IDs ⚠                    | skills, data       |             0/3              |              1/3               |
| Release notes in house format ⚠                | skills, writing    |             0/3              |              2/3               |
| Generate ACME invoice IDs                      | skills, data       |             0/3              |              3/3               |
| Classify incident severities by policy         | skills, data       |             0/3              |              3/3               |
| Control: stacked discounts                     | control, reasoning |             3/3              |              3/3               |
| Control: count files with TODO markers         | control, tools     |             3/3              |              3/3               |

## Method

Unit of analysis is the task: each task contributes its mean over trials, so every task weighs equally. Intervals are 95% two-level cluster-bootstrap percentile intervals (resample tasks, then trials within each task; 4000 iterations). Comparisons are paired by task. p-values come from a two-sided sign-flip permutation test on per-task differences (exact for ≤ 16 tasks) and are Holm–Bonferroni adjusted across all comparisons against the baseline. A difference is called significant only when the adjusted p-value is below 0.05 and the interval excludes zero. Runs that ended in infrastructure errors (provider outages, throttling, harness crashes) are excluded; timeouts and exhausted turn budgets count as failures. All resampling is seeded with the experiment seed, so the report is reproducible.

<sub>Generated 2026-10-15T08:04:15.608Z from experiment `d225a68d-6bb6-40cd-9dd4-d77b2cc21866` by scripts/export-report.mjs.</sub>
