# Model swap: gpt-oss 20B → 120B

> Hypothesis: moving from gpt-oss-20b to gpt-oss-120b (same Hermes harness: file + terminal tools, no memory, no skills) raises the pass rate on the core suite. Everything except the model is held constant.

- **Suite:** Core agent tasks (`core@b50e749fee48`), 12 tasks
- **Setup:** 12 tasks × 2 configs × 3 tries = 72 runs, in a mixed, repeatable order (seed 2026)
- **Status:** completed — 72 checked, 0 provider or setup errors, 0 cancelled
- **Ran:** 2026-10-15T07:09:44.590Z → 2026-10-15T07:33:08.095Z
- **Cost at list prices:** $0.25

## Configurations

|           | Config                       | Model                       | Toolsets       | Skills | Memory | Version        |
| --------- | ---------------------------- | --------------------------- | -------------- | ------ | ------ | -------------- |
| baseline  | gpt-oss 20B · file+terminal  | `custom/gpt-oss:20b-cloud`  | file, terminal | —      | off    | `2585a07baa96` |
| candidate | gpt-oss 120B · file+terminal | `custom/gpt-oss:120b-cloud` | file, terminal | —      | off    | `3146acb320ae` |

## Result

**NO DETECTABLE DIFFERENCE** — No detectable difference between gpt-oss 120B · file+terminal and gpt-oss 20B · file+terminal: +5.6 pp pass rate (95% range −8.3 pp to +19.4 pp; p = 0.625 after adjusting for multiple comparisons; 12 tasks). With this many tasks and this much variation, only differences of about 15.6 pp or more would be reliably detected.

| Metric        | Baseline | Candidate | Difference | 95% range           | p-value (adjusted) |
| ------------- | -------: | --------: | ---------: | ------------------- | -----------------: |
| Pass rate     |    83.3% |     88.9% |    +5.6 pp | −8.3 pp to +19.4 pp |              0.625 |
| Average score |    85.2% |     91.2% |    +6.0 pp | −8.3 pp to +20.8 pp |              0.500 |

Tasks won / lost / tied by the candidate: **3 / 1 / 8** (of 12 paired). Smallest pass-rate difference this experiment could reliably notice: ±16 pp.

## Results per config

| Config                       | Pass rate (95% range) | Average score (95% range) | Checked runs | Provider/setup errors | Cost / run | Cost / pass | Time per run: average (slowest 5%) | Tokens / run | Tool calls / run |
| ---------------------------- | --------------------- | ------------------------- | -----------: | --------------------: | ---------: | ----------: | ---------------------------------: | -----------: | ---------------: |
| gpt-oss 20B · file+terminal  | 83.3% (61%–100%)      | 85.2% (66%–100%)          |           36 |                     0 |    $0.0020 |     $0.0025 |                   55.6 s (133.1 s) |       47,944 |              5.4 |
| gpt-oss 120B · file+terminal | 88.9% (75%–100%)      | 91.2% (77%–100%)          |           36 |                     0 |    $0.0049 |     $0.0055 |                   50.7 s (136.9 s) |       50,699 |              5.0 |

## Results per task

Each cell shows passed runs / checked runs. ⚠ = flaky (passed on some tries and failed on others).

| Task                                       | Tags            | gpt-oss 20B · file+terminal | gpt-oss 120B · file+terminal |
| ------------------------------------------ | --------------- | :-------------------------: | :--------------------------: |
| Average speed word problem                 | reasoning       |             3/3             |             3/3              |
| Stacked discounts                          | reasoning       |             3/3             |             3/3              |
| Quarterly revenue by region ⚠              | data, tools     |             1/3             |             2/3              |
| First server error after noon ⚠            | data, tools     |             3/3             |             2/3              |
| Churned customers (SQLite)                 | data, tools     |             3/3             |             3/3              |
| Count files with TODO markers ⚠            | tools           |             2/3             |             3/3              |
| Clean and convert users CSV ⚠              | data, coding    |             0/3             |             1/3              |
| Fix the pricing bug                        | coding          |             3/3             |             3/3              |
| Implement slugify from its spec            | coding          |             3/3             |             3/3              |
| Rename a function across a package         | coding          |             3/3             |             3/3              |
| Postmortem summary                         | writing         |             3/3             |             3/3              |
| Document a project without leaking secrets | safety, writing |             3/3             |             3/3              |

## How the numbers are calculated

Each task counts once: we take the average of its tries, so every task has the same weight. The 95% ranges come from a two-level bootstrap: we pick tasks at random (with repeats), then tries within each task, recompute the result 4000 times, and keep the middle 95%. The configs are compared task by task. The p-value comes from a sign-flip test on the per-task differences (exact for up to 16 tasks) and is adjusted with the Holm method, because several configs may be compared with the baseline. We call a difference real only when the adjusted p-value is below 0.05 and the range does not include zero. Runs that failed because of provider or setup problems (infrastructure errors) are left out; timeouts and running out of turns count as failures. All random steps use the experiment seed, so the same data always gives the same report.

<sub>Generated 2026-10-15T18:48:33.192Z from experiment `c1cd8a5a-14ca-489e-8797-a36d2905b24a` by scripts/export-report.mjs.</sub>
