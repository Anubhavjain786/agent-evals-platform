# Video of the working system

- **Automatic walkthrough (no sound, with captions, about 75 seconds):**
  [`docs/media/demo.mp4`](media/demo.mp4). It was recorded from the real
  running system with the real experiment data, using `npm run demo:record`
  (headless Chrome + ffmpeg), so it can be recorded again at any time.
- **Walkthrough with voice:** record it yourself using the script below
  (QuickTime or Loom, about 5 minutes).

## Script for the voice walkthrough

Before recording: run `docker compose up --build`, check that the "Model swap:
gpt-oss 20B → 120B" experiment is there (see [experiments/](experiments/)), and
start a small new experiment a minute before you press record, so live
progress is visible.

| #   | Show                                                                      | Say                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Terminal: `docker compose up --build`, then the Hermes version at the top | "One command starts everything. The image is built on the official Hermes Agent image, so every run uses the real Hermes."                                          |
| 2   | **Task suites → Core agent tasks**, open _Fix the pricing bug_            | "Tasks are YAML files in the repo: a prompt, starting files and checks. This one is checked by hidden unit tests that are copied in only after the agent finishes." |
| 3   | **Agent configs**, open _gpt-oss 120B · +memory +skills_                  | "A config is everything we might change: model, tools, skills, memory, persona, turn limit. Each run gets a fresh Hermes setup built from it."                      |
| 4   | **New experiment**: pick the suite, two configs, 3 tries                  | "Every task runs with every config three times, in a mixed order, so if the provider gets slow it affects both configs equally."                                    |
| 5   | The running experiment page                                               | "Progress updates live. The numbers update as runs finish and are marked as provisional until the end."                                                             |
| 6   | The finished model-swap experiment: the result card                       | "Here is the answer: the difference, its 95% range, the p-value, wins and losses, and the smallest difference this experiment could notice."                        |
| 7   | The pass-rate chart and the difference chart                              | "The ranges are calculated per task, not per run, because tries of the same task are not independent."                                                              |
| 8   | The per-task table; click a cell where the configs differ                 | "This shows where the difference comes from. Clicking a cell shows those runs."                                                                                     |
| 9   | A failed run: summary, checks, steps, files                               | "And this is why it failed: the check and its evidence, every tool call with its input and output, and the files the agent left behind."                            |
| 10  | The cost and speed table                                                  | "Cost and time per run and per passed task, from the real token usage."                                                                                             |
| 11  | The deliverables table in the README                                      | "The design document, known limits, costs and the experiment results are all in the repo."                                                                          |
