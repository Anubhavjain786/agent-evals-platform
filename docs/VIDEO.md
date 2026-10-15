# Video of the working system

- **Automated walkthrough (silent, captioned, ~70 s):** [`docs/media/demo.mp4`](media/demo.mp4) — recorded from
  the real running system with real experiment data by `npm run demo:record`
  (Chrome DevTools screencast → ffmpeg), so it can be regenerated at any time.
- **Narrated walkthrough:** record with the script below (QuickTime / Loom, ~5 minutes).

## Narrated walkthrough script

Before recording: `docker compose up --build`, make sure the "Model swap: gpt-oss 20B → 120B"
experiment exists (see [experiments/](experiments/)), and start a small new experiment a minute
before you hit record so live progress is visible.

| #   | Show                                                                          | Say                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Terminal: `docker compose up --build`, then the header's Hermes version badge | "One command. The image is built on the official Hermes Agent image, so every run executes the real Hermes CLI."                                                        |
| 2   | **Task suites → Core agent tasks**, expand _Fix the pricing bug_              | "Tasks are YAML in the repo: a prompt, a workspace fixture and checks. This one is graded by hidden unit tests that are copied in only after the agent finishes."       |
| 3   | **Agent configs**, open _gpt-oss 120B · +memory +skills_                      | "A config is everything we might change: model, toolsets, skills, memory, persona, turn budget. Each run gets a fresh Hermes home built from it."                       |
| 4   | **New experiment**: pick the suite, select two configs, 3 trials              | "Every task runs under every config three times, interleaved in random order so provider hiccups hit both configs equally."                                             |
| 5   | The running experiment page                                                   | "Progress streams live over server-sent events; the statistics update as runs land and are clearly marked provisional."                                                 |
| 6   | The finished model-swap experiment: verdict card                              | "Here's the answer: the effect, its 95% interval, a Holm-adjusted p-value from a paired permutation test, wins/losses, and the smallest effect this design can detect." |
| 7   | Interval plot + forest plot                                                   | "Intervals come from a two-level bootstrap — tasks first, then trials — because runs of the same task aren't independent."                                              |
| 8   | Per-task heatmap, click a cell where the configs differ                       | "This shows where the difference comes from. Clicking filters the runs."                                                                                                |
| 9   | A failed run: headline, checks, trajectory, workspace                         | "And this is why it failed: the check and its evidence, every tool call with arguments and output, and the files the agent left behind."                                |
| 10  | Cost & efficiency table                                                       | "Cost and latency per run and per passed task, from token usage at list prices."                                                                                        |
| 11  | README deliverables table                                                     | "Design doc, known limits, costs and the experiment write-up are in the repo."                                                                                          |
