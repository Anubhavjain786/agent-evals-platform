# Experiment results

We ran two real experiments on the platform on 15 October 2026, with real
model calls: Hermes Agent v0.22.1 in Docker, models from Ollama Cloud through
Ollama on the local machine, and `gemma4:31b-cloud` as the LLM judge. The full
generated reports are in the same folder as this file.

- [Experiment 1 — Changing the model](#experiment-1-changing-the-model): the
  required comparison of two configurations.
- [Experiment 2 — Memory and skills](#experiment-2-memory-and-skills): a
  comparison of Hermes features, which is what the platform was built for.

**How to read the numbers**

- **pp** means _percentage points_. Going from 80% to 85% is +5 pp.
- **95% range** (also called a confidence interval) is where the true
  difference most likely is. If the range includes 0, we cannot be sure there
  is any difference.
- **p-value** is how likely a difference this big would be if the two configs
  were actually the same. Below 0.05 means "unlikely to be luck". The p-values
  here are adjusted for comparing several configs (Holm correction).

---

## Experiment 1: changing the model

**Question.** If we switch the agent from `gpt-oss:20b` to `gpt-oss:120b` and
change nothing else, does it pass more of the core tasks?

**Setup.**

|           |                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Suite     | `core@b50e749fee48` — 12 tasks: 2 reasoning, 4 data/tool use, 4 coding (2 checked by hidden tests), 1 writing task checked by a judge, 1 safety task about secrets |
| Baseline  | `gpt-oss-20b@2585a07baa96` — gpt-oss 20B, `file` + `terminal` tools, no memory, no skills, 20 turns                                                                |
| Candidate | `gpt-oss-120b@3146acb320ae` — exactly the same, except the model                                                                                                   |
| Tries     | 3 per task per config → 72 runs, in a mixed, repeatable order (seed 2026)                                                                                          |
| Outcome   | 72 / 72 runs checked · 0 provider or setup errors · 0 retries · about 24 minutes · $0.25 at list prices ($0 actually paid)                                         |

**Result: no detectable difference.**

|                                     | gpt-oss 20B (baseline) |      gpt-oss 120B |         Difference | 95% range        | p-value |
| ----------------------------------- | ---------------------: | ----------------: | -----------------: | ---------------- | ------: |
| Pass rate                           |                  83.3% |             88.9% |        **+5.6 pp** | −8.3 to +19.4 pp |   0.625 |
| Average score (with partial credit) |                  85.2% |             91.2% |            +6.0 pp | −8.3 to +20.8 pp |   0.500 |
| Tasks won / lost / tied by 120B     |                        |                   |          3 / 1 / 8 |                  |         |
| Cost per run · per passed run       |      $0.0020 · $0.0025 | $0.0049 · $0.0055 | 2.2× more per pass |                  |         |
| Time per run (average)              |                 55.6 s |            50.7 s |             −4.9 s |                  |         |
| Smallest difference we could detect |                        |                   |             ±16 pp |                  |         |

![Experiment 1 result](../media/model-swap/experiment.png)

![Experiment 1 per-task results](../media/model-swap/task-matrix.png)

### What this means

1. **120B looks slightly better, but we cannot say it is better.** The 95%
   range goes from −8.3 to +19.4 points, so it includes zero, and the p-value
   is 0.625. A difference this small could easily be random luck.
2. **The suite is the problem, not the models.** In 8 of the 12 tasks, both
   models passed every try. Tasks where both always pass add nothing to the
   comparison, so only 4 tasks could show a difference. With only 4 tasks, even
   a perfect win could not get the p-value below 0.125. The report says this
   directly: with this setup, we can only reliably notice differences of about
   16 points or more. To notice a +5.6 point difference, we would need about
   90 tasks like these. Harder tasks (ones that pass 30–70% of the time) would
   need far fewer.
3. **Where the models differed, and why** (from looking at the runs):

   | Task                          | 20B | 120B | What happened                                                                                                                                                                                                                                                        |
   | ----------------------------- | :-: | :--: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Clean and convert users CSV   | 0/3 | 1/3  | 20B applied the email rule wrongly (kept an address with `-at-`, removed valid ones). 120B's two failures never wrote the file at all: its thinking used up all its output tokens. That is a settings problem (reasoning effort / output limit), not a wrong answer. |
   | Quarterly revenue by region   | 1/3 | 2/3  | One wrong date filter for a region, one missing report file, and one correct file but an answer that did not name the top region.                                                                                                                                    |
   | Count files with TODO markers | 2/3 | 3/3  | One 20B run counted the TODO lines (5) instead of the files (3).                                                                                                                                                                                                     |
   | First server error after noon | 3/3 | 2/3  | One 120B run answered without searching the log and made up a request id.                                                                                                                                                                                            |

4. **Agents are not consistent.** Four tasks passed on some tries and failed on
   others, with the same config. If we had run each task only once, we would
   have drawn confident conclusions that were partly luck.
5. **Cost.** 120B costs about 2.4 times more per run and 2.2 times more per
   passed task, and it is a little faster with fewer tool calls. Both are very
   cheap on this suite. The log-search task is the most expensive task for both
   (see [COSTS.md](../COSTS.md)).

### Decision and next steps

- Based on this evidence, **paying 2.2 times more per passed task for 120B is
  not justified for tasks like these.** Keep 20B as the default, or run the
  experiment again on a harder suite before deciding.
- The next experiments the data suggests: (a) add harder data-cleaning and
  multi-file coding tasks, so the suite can tell models apart; (b) run 120B
  again with `reasoningEffort: low` (or a bigger output limit), because two of
  its failures were running out of tokens, not mistakes.

---

## Experiment 2: memory and skills

**Question.** If we turn on Hermes' memory (filled with facts from "earlier
conversations") and give the agent the team's skills, do the tasks that need
that knowledge get better? And does anything else get worse?

**Setup.**

|           |                                                                                                                                                                                                                                                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Suite     | `harness@be14b9f932d1` — 11 tasks: 5 need facts that exist only in memory (writing style, staging database address, preferred units, commit message format, production region), 4 need procedures that exist only in skills (invoice ID check ×2, release notes format, severity policy), and 2 control tasks need neither |
| Baseline  | `gpt-oss-120b@3146acb320ae` — file + terminal tools, no memory, no skills                                                                                                                                                                                                                                                  |
| Candidate | `gpt-oss-120b-memory-skills@6bc777b1b466` — same model and turn limit, plus the `skills` and `memory` tools, three skills, four memory notes and a user profile                                                                                                                                                            |
| Tries     | 3 → 66 runs, in a mixed order (seed 2026)                                                                                                                                                                                                                                                                                  |
| Outcome   | 66 / 66 runs checked · 0 provider or setup errors · about 25 minutes · $0.15 at list prices                                                                                                                                                                                                                                |

**Result: better, and we can be confident about it.**

|                                   |          Baseline | + memory + skills |        Difference | 95% range         | p-value |
| --------------------------------- | ----------------: | ----------------: | ----------------: | ----------------- | ------: |
| Pass rate                         |             18.2% |             87.9% |      **+69.7 pp** | +45.5 to +90.9 pp |   0.004 |
| Average score                     |             41.8% |             87.9% |          +46.0 pp | +22.8 to +68.9 pp |   0.004 |
| Tasks won / lost / tied           |                   |                   |         9 / 0 / 2 |                   |         |
| Control tasks (2)                 |               6/6 |               6/6 | nothing got worse |                   |         |
| Cost per run · per passed run     | $0.0027 · $0.0100 | $0.0019 · $0.0022 |       −30% · −78% |                   |         |
| Time per run · tool calls per run |      38.3 s · 4.2 |      30.6 s · 1.9 |                   |                   |         |

![Experiment 2 charts](../media/charts.png)

### What this means

1. **Memory and skills clearly work.** Every task that needed them went from
   0/3 to at least 1/3, and seven of the nine went to 2/3 or 3/3. The 95% range
   is far away from zero, and the p-value over 11 tasks is 0.004.
2. **Nothing else got worse.** This is the other half of the question: both
   control tasks stayed at 3/3.
3. **It is also cheaper and faster.** Without the knowledge, the baseline
   searched the folder and guessed (4.2 tool calls per run). With it, the agent
   answered directly (1.9). The cost per passed task dropped by about 78%.
4. **The remaining failures were about doing, not knowing.** You can see this
   in each run's steps:
   - _Commit message_ and _release notes_ (one try each): the final answer had
     the correct text in the right format, but the agent never saved it to the
     file it was asked to write.
   - _Validate invoice IDs_ (two tries): the agent opened the skill, but then
     tried to calculate 30 check letters in its head instead of running the
     skill's Python code in the terminal, and ran out of output tokens.

   These suggest the next experiments: add a line to the skill saying "run
   the code, do not calculate by hand", and try the reasoning-effort setting
   already mentioned in experiment 1.

5. **A note on the size of the effect.** These tasks were written so they are
   impossible without the knowledge, so +70 points is the best case, not what
   to expect everywhere. The fair conclusion is: the platform detected a real
   change in Hermes settings with high confidence, showed which tasks it came
   from, and confirmed that nothing else moved. In real use, the gain depends
   on how many of your tasks need remembered or packaged knowledge.

### Both experiments together

The two experiments show the platform giving the right kind of answer in both
cases. A change that does not make a visible difference on this suite is
reported as _no detectable difference_, together with the smallest difference
it could have seen. A change that does make a difference is reported as
_better_, with a range, an adjusted p-value, the tasks it came from, and its
cost.
