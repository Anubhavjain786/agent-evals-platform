# Memory & skills on vs off (gpt-oss 120B)

> Hypothesis: enabling Hermes persistent memory (seeded with facts from earlier sessions) and the team skills improves the tasks that depend on them, without regressing the control tasks. The model and every other setting are held constant.

- **Suite:** Memory & skills tasks (`harness@be14b9f932d1`), 11 tasks
- **Setup:** 11 tasks × 2 configs × 3 tries = 66 runs, in a mixed, repeatable order (seed 2026)
- **Status:** completed — 66 checked, 0 provider or setup errors, 0 cancelled
- **Ran:** 2026-10-15T07:35:02.235Z → 2026-10-15T08:03:49.174Z
- **Cost at list prices:** $0.15

## Configurations

|           | Config                         | Model                       | Toolsets                       | Skills                                                    | Memory | Version        |
| --------- | ------------------------------ | --------------------------- | ------------------------------ | --------------------------------------------------------- | ------ | -------------- |
| baseline  | gpt-oss 120B · file+terminal   | `custom/gpt-oss:120b-cloud` | file, terminal                 | —                                                         | off    | `3146acb320ae` |
| candidate | gpt-oss 120B · +memory +skills | `custom/gpt-oss:120b-cloud` | file, terminal, skills, memory | acme-invoice-ids, release-notes-format, incident-severity | on     | `6bc777b1b466` |

## Result

**BETTER** — gpt-oss 120B · +memory +skills is better than gpt-oss 120B · file+terminal: +69.7 pp pass rate (95% range +45.5 pp to +90.9 pp; p = 0.004 after adjusting for multiple comparisons; 11 tasks).

| Metric        | Baseline | Candidate | Difference | 95% range            | p-value (adjusted) |
| ------------- | -------: | --------: | ---------: | -------------------- | -----------------: |
| Pass rate     |    18.2% |     87.9% |   +69.7 pp | +45.5 pp to +90.9 pp |              0.004 |
| Average score |    41.8% |     87.9% |   +46.0 pp | +22.8 pp to +68.9 pp |              0.004 |

Tasks won / lost / tied by the candidate: **9 / 0 / 2** (of 11 paired). Smallest pass-rate difference this experiment could reliably notice: ±34 pp.

## Results per config

| Config                         | Pass rate (95% range) | Average score (95% range) | Checked runs | Provider/setup errors | Cost / run | Cost / pass | Time per run: average (slowest 5%) | Tokens / run | Tool calls / run |
| ------------------------------ | --------------------- | ------------------------- | -----------: | --------------------: | ---------: | ----------: | ---------------------------------: | -----------: | ---------------: |
| gpt-oss 120B · file+terminal   | 18.2% (0%–45%)        | 41.8% (21%–64%)           |           33 |                     0 |    $0.0027 |       $0.01 |                    38.3 s (72.9 s) |       27,040 |              4.2 |
| gpt-oss 120B · +memory +skills | 87.9% (73%–100%)      | 87.9% (70%–100%)          |           33 |                     0 |    $0.0019 |     $0.0022 |                    30.6 s (55.6 s) |       19,881 |              1.9 |

## Results per task

Each cell shows passed runs / checked runs. ⚠ = flaky (passed on some tries and failed on others).

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

## How the numbers are calculated

Each task counts once: we take the average of its tries, so every task has the same weight. The 95% ranges come from a two-level bootstrap: we pick tasks at random (with repeats), then tries within each task, recompute the result 4000 times, and keep the middle 95%. The configs are compared task by task. The p-value comes from a sign-flip test on the per-task differences (exact for up to 16 tasks) and is adjusted with the Holm method, because several configs may be compared with the baseline. We call a difference real only when the adjusted p-value is below 0.05 and the range does not include zero. Runs that failed because of provider or setup problems (infrastructure errors) are left out; timeouts and running out of turns count as failures. All random steps use the experiment seed, so the same data always gives the same report.

<sub>Generated 2026-10-15T18:48:33.576Z from experiment `d225a68d-6bb6-40cd-9dd4-d77b2cc21866` by scripts/export-report.mjs.</sub>
