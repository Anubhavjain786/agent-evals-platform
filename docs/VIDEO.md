# Video of the working system

- **Automatic walkthrough (no sound, with captions, about 75 seconds):**
  [`docs/media/demo.mp4`](media/demo.mp4). It was recorded from the real
  running system with the real experiment data, using `npm run demo:record`
  (headless Chrome + ffmpeg), so it can be recorded again at any time.
- **Walkthrough with voice:** record it yourself using the script below
  (QuickTime or Loom, about 6–7 minutes).

---

# Script for the voice walkthrough

The video has two halves:

1. **Part A — the app (about 4 minutes).** Show that it works and what it
   answers.
2. **Part B — the code (about 2–3 minutes).** Show the few places where the
   important decisions live.

You do not need to read the lines word for word. Read them once before you
record, then say them in your own words. Speaking naturally sounds better than
reading.

## Before you record

- [ ] Run `docker compose up --build` and open <http://localhost:3000>.
- [ ] Check that both experiments are there: "Model swap" and "Memory & skills".
- [ ] One minute before you press record, start a small experiment so the
      live progress is visible: **New experiment → Core agent tasks**, pick
      2 configs, untick "Run all tasks" and pick 2 tasks, **Tries per task = 1**.
- [ ] Open the project in VS Code. Set the font size larger (`Cmd +` two or
      three times) so code is readable in the video.
- [ ] Close Slack, email and other notifications.
- [ ] Turn on the microphone in QuickTime (**Options → Microphone**).

**How to jump to a line in VS Code:** press `Cmd + P`, type the file name,
press Enter, then press `Ctrl + G` and type the line number. To highlight,
click at the start line, then `Shift + click` at the end line.

> Line numbers below are approximate. If a line moved, search for the code
> shown in the "Highlight" column (`Cmd + F`).

---

## Part A — the app

### A1. Introduction (20 seconds)

**Show:** the Experiments page.

**Say:** "Hi, I'm Anubhav. This is my Agent Evals Platform. It answers one
question: when we change something in an AI agent — the model, a skill, or
memory — does the agent get better, worse, or stay the same? And how sure can
we be? It is built with NestJS, Vue 3 and TypeScript, on top of the real Hermes
Agent."

**Why:** the reviewer immediately knows the problem you solved and the stack.

### A2. One command to run (20 seconds)

**Show:** the terminal with `docker compose up --build`, then the green Hermes
version at the top right of the app.

**Say:** "Everything starts with one command. The Docker image is built on the
official Hermes Agent image, so every run in this platform uses the real Hermes,
not a mock."

**Why:** "runs locally with a single command" is a requirement. This proves it.

### A3. Tasks and how they are checked (40 seconds)

**Show:** **Task suites → Core agent tasks**, then click **Fix the pricing bug**
to open it.

**Say:** "A task suite is a list of tasks. Each task has a prompt, some starting
files, and checks that decide pass or fail. This task gives the agent a small
Python project with a bug. It passes only if the visible tests pass **and**
some hidden tests pass. The hidden tests are copied into the folder only after
the agent has finished, so the agent cannot see them or cheat."

**Why:** shows requirement 1 (define tasks and how each is scored) and that you
thought about cheating.

### A4. Agent configs (30 seconds)

**Show:** **Agent configs**, then open **gpt-oss 120B · +memory +skills**.

**Say:** "A config is the thing we are testing: the model, the tools, the
skills, memory, and the turn limit. This one has memory turned on, with some
facts from 'earlier conversations', and three team skills. Every run gets a
brand-new Hermes setup built from its config, so runs never affect each other."

**Why:** shows requirement 2 (define configs: model, skills, memory, tools).

### A5. Starting an experiment and live progress (30 seconds)

**Show:** **New experiment** (just show the form, do not submit), then open the
small experiment you started before recording.

**Say:** "To compare configs, I pick a suite, the configs and the number of
tries. Every task runs with every config several times, because agents give
different answers each time. Runs are done in a mixed order, so if the model
provider gets slow for a while, it affects both configs equally. Progress
updates live while runs finish."

**Why:** shows requirement 3 (run the tasks under each config) and fair
measurement.

### A6. The answer: better, worse, or the same? (60 seconds)

**Show:** open **Model swap: gpt-oss 20B → 120B**. Point at the result card.
Then scroll to the two charts.

**Say:** "Here is the first real experiment: the same agent with a 20-billion
and a 120-billion parameter model. 72 real runs. The bigger model passed 5.6
points more, but the 95% range goes from minus 8 to plus 19, so it includes
zero, and the p-value is 0.63. So the honest answer is: **no detectable
difference**. The platform also says the smallest difference this experiment
could notice is about 16 points. It does not pretend that 'not significant'
means 'equal'."

Then open **Memory & skills on vs off**.

**Say:** "The second experiment turns on memory and skills. Here the result is
clear: plus 70 points, the range is far from zero, p-value 0.004, and the two
control tasks did not change. So the platform can tell a real improvement
from noise."

**Why:** this is the core of the assignment (requirement 4: is one config
better, and how confident are we). Showing both a "no difference" and a
"better" result proves the statistics are honest.

### A7. Where the difference comes from (20 seconds)

**Show:** scroll to **Results per task** in the Model swap experiment. Click
the cell for **Clean and convert users CSV** under one of the configs.

**Say:** "This table shows each task. Most tasks were passed by both models
every time, which is why the suite cannot separate them. Clicking a cell shows
those runs."

### A8. Why did a run fail? (40 seconds)

**Show:** click a **failed** run in the list. Show the red summary line, the
**Checks**, then expand one tool call in **Steps**, then **Files after the run**.

**Say:** "This answers why a run failed. At the top is the check that failed
and why. Here are all the steps the agent took — every tool call with its input
and output and how long it took. And here are the files the agent left behind,
marked as new or edited."

**Why:** requirement 5 (inspect a run to understand why it passed or failed).

### A9. Cost (15 seconds)

**Show:** scroll back up to **Cost and speed** in an experiment.

**Say:** "It also tracks cost and time per run and per passed task, from real
token usage. The two experiments together cost about 40 cents at list prices."

---

## Part B — the code

**Say first:** "Now a quick look at the code, at the places where the main
decisions are."

### B1. How Hermes is run (30 seconds)

**Open:** `apps/api/src/execution/hermes/hermes-home.ts`

**Highlight:** the function `buildHermesArgs` (around **line 124**), the list
that contains `'chat', '--oneshot', '--format', 'stream-json'`.

**Say:** "I run Hermes through its official one-shot command-line mode with
JSON output. Every step the agent takes comes back as one JSON line, and Hermes
writes token usage and cost to a file. Each run is its own process."

**Then highlight:** in `buildHermesConfig` (around **line 40**), the lines with
`background_review: { enabled: false }` and `title_generation: { enabled: false }`.

**Say:** "For every run I generate a fresh Hermes config. Anything we are not
testing is turned off, so it cannot add noise or cost."

### B2. Every run is isolated (20 seconds)

**Open:** `apps/api/src/execution/hermes/hermes-cli.runner.ts`

**Highlight:** the `buildEnv` function, around **lines 122–140**, especially
`HERMES_HOME: dirs.home` and `HERMES_WRITE_SAFE_ROOT: dirs.workspace`.

**Say:** "Each run gets its own Hermes home and its own folder, and Hermes is
only allowed to write inside that folder. The agent also gets only the one API
key it needs — no other secrets."

### B3. Provider errors are not agent failures (25 seconds)

**Open:** `apps/api/src/execution/hermes/usage.ts`

**Highlight:** the function `classifyOutcome` (around **line 118**), especially
the line `if (isInfraError(error))` and the "failed before a single model call"
check (around **line 145**).

**Say:** "If the model provider is down or rate-limited, that is not the
agent's fault, so those runs are retried and then left out of the statistics.
I found this rule while testing: a wrong Hermes setting was first counted as
the agent failing, which would make a model look worse for no reason."

### B4. The statistics (40 seconds)

**Open:** `apps/api/src/analysis/stats.ts`

**Highlight:** the comment at the top of the file (lines 1–12), then the
function `signFlipTest` (around **line 168**).

**Say:** "This is the most important part. Tries of the same task are not
independent, so I count by task, not by run, and compare the two configs task
by task. The confidence range comes from a bootstrap — resampling tasks, then
tries. The p-value comes from a sign-flip test: if the configs were really the
same, each task's difference would be equally likely to be positive or
negative."

**Then open:** `apps/api/src/analysis/report.builder.ts`

**Highlight:** the function `decideVerdict` (around **line 278**).

**Say:** "And this is the rule for the verdict: 'better' or 'worse' only if
the adjusted p-value is below 0.05 **and** the range does not include zero.
Otherwise it says 'no detectable difference'."

### B5. Tests (15 seconds)

**Open:** `apps/api/test/experiments.e2e.test.ts`

**Highlight:** the `it(...)` test names (around **lines 198–280**).

**Say:** "There are 78 tests. This one starts the whole backend with a fake
agent and checks the full flow: create, run, score, report, retries and
cancelling. CI runs all tests and the Docker build on GitHub."

---

## Closing (15 seconds)

**Show:** the README on GitHub, at the deliverables table.

**Say:** "Everything is in the repo: the design document with the main
decisions, the known limits, the costs, and the analysis of both experiments.
Thanks for watching."

---

## Tips

- **Total time:** aim for 6–7 minutes. If you go over, shorten A5 and A9
  first; do not cut A6, A8 or B4.
- **Mistakes are fine.** If you make a small mistake, keep going. You can also
  record Part A and Part B as two separate videos and send both links.
- **Move slowly.** Move the mouse slowly and pause for one second on each
  screen, so the viewer can read it.
- **Upload:** save the file, upload it to Google Drive or Loom, and set the
  link to "anyone with the link can view".
