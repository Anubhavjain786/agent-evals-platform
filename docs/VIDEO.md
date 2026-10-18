# Video of the working system

- **Automatic walkthrough (no sound, with captions, about 75 seconds):**
  [`docs/media/demo.mp4`](media/demo.mp4). It was recorded from the real
  running system with the real experiment data, using `npm run demo:record`
  (headless Chrome + ffmpeg), so it can be recorded again at any time.
- **Walkthrough with voice:** record it yourself using the script below
  (QuickTime or Loom, about 10–12 minutes).

---

# Script for the voice walkthrough

Imagine you are sharing your screen with a colleague and showing them what you
built. That is the tone. Relaxed, friendly, and not in a hurry.

The video has three parts:

1. **Part A — the app (about 6–7 minutes).** What it does and what it tells us.
2. **Part B — the code (about 3–4 minutes).** The few places where the
   important decisions live.
3. **Closing (about 30 seconds).**

**How to use this script:** do not read it word for word. Read each part once,
then say it in your own words. The lines in _italics_ are small notes for you
(like "pause here"), not things to say.

## Before you record

- [ ] Run `docker compose up --build` and open <http://localhost:3000>.
- [ ] Check that both experiments are there: "Model swap" and "Memory & skills".
- [ ] About two minutes before you press record, start a small experiment so
      live progress is visible: **New experiment → Core agent tasks**, pick
      2 configs, untick "Run all tasks", pick 2 tasks, **Tries per task = 1**.
- [ ] Open the project in VS Code. Make the font bigger (`Cmd +` two or three
      times) so the code is readable in the video.
- [ ] Close Slack, email and other notifications.
- [ ] Turn on the microphone in QuickTime (**Options → Microphone**).
- [ ] Have a glass of water nearby. Ten minutes of talking is longer than it
      sounds.

**VS Code shortcuts:** `Cmd + P` opens a file by name. `Ctrl + G` jumps to a
line number. To highlight lines, click at the start, then `Shift + click` at
the end. Line numbers below are approximate; if one moved, use `Cmd + F` and
search for the function name.

---

## Part A — the app

### A1. Introduction (about 45 seconds)

**Show:** the Experiments page.

**Say:**

> "Hi, I'm Anubhav. Thanks for taking the time to watch this.
>
> So, the problem in this assignment is something every team building AI
> agents runs into. You make a change to your agent — maybe you switch to a
> bigger model, maybe you add a new skill, maybe you turn on memory — and then
> someone asks: _did that actually make it better?_
>
> And honestly, most of the time the answer is a gut feeling. Someone tries
> three or four prompts, it looks a bit better, and we ship it.
>
> So I built a platform that answers that question with real evidence. It runs
> the same set of tasks with two or more agent setups, many times, checks every
> result, and then tells you: better, worse, or no difference — and, just as
> important, _how sure_ we can be about that answer.
>
> It's built with NestJS on the backend, Vue 3 on the frontend, TypeScript
> everywhere, and it runs on top of the real Hermes Agent from Nous Research."

_Pause for a second before moving on._

### A2. One command to start (about 30 seconds)

**Show:** the terminal with `docker compose up --build`. Then switch to the
browser and point at the green Hermes version at the top right.

**Say:**

> "Let me first show how you start it. It's just one command:
> `docker compose up --build`.
>
> The Docker image is built on top of the official Hermes Agent image. So when
> this platform runs a task, it's the real Hermes doing the work — not a fake,
> not a mock. You can see the Hermes version it found, up here in the corner."

### A3. Tasks, and how they are checked (about 1 minute)

**Show:** **Task suites → Core agent tasks**. Scroll the list slowly. Then
click **Fix the pricing bug** to open it.

**Say:**

> "Let's start with the tasks, because everything begins here.
>
> A task suite is just a list of tasks. This core suite has twelve of them —
> some reasoning questions, some data work with files, some coding tasks, a
> writing task, and one safety task about not leaking secrets.
>
> Each task has three things: a prompt, some starting files, and a list of
> checks that decide if the agent passed.
>
> Let me open this one — _fix the pricing bug_. The agent gets a small Python
> project with a bug in it, and the prompt says: the tests are failing, fix
> the code, and don't touch the tests.
>
> Now, here's a detail I like. Look at the checks. The first check runs the
> tests the agent can see. But the second one runs _hidden_ tests. Those hidden
> tests are copied into the folder only _after_ the agent is finished. So the
> agent can't read them, and it can't cheat by just making the visible tests
> pass.
>
> And all of this is a YAML file in the repo, so tasks can be reviewed in a
> pull request just like normal code."

### A4. Agent configs (about 45 seconds)

**Show:** **Agent configs**. Then open **gpt-oss 120B · +memory +skills**.

**Say:**

> "Next, the agent configs. A config is basically the thing we're testing.
>
> It has the model, which tools the agent can use, which skills it has,
> whether memory is on, and how many turns it gets.
>
> This one is interesting. It uses the 120-billion parameter model, memory is
> turned on, and memory already has a few facts in it — like the address of the
> staging database, or the team's commit message format. Think of it as things
> the agent 'remembers' from earlier conversations. It also has three team
> skills, like how to check an invoice ID.
>
> One important thing: every single run gets a brand-new Hermes setup built
> from this config. Fresh memory, only these skills, its own folder. So one run
> can never leak into another."

### A5. Starting an experiment (about 1 minute)

**Show:** **New experiment**. Pick a suite and two configs, so the run count
appears, but **do not submit**. Then open the small experiment you started
before recording.

**Say:**

> "Now let's compare two configs. To start an experiment, I pick a suite, I
> pick the configs, and I pick how many tries per task.
>
> Why more than one try? Because agents are not consistent. You can give the
> same agent the same task twice and get a pass the first time and a fail the
> second time. So if you only run each task once, you're partly measuring luck.
> I usually use three tries.
>
> You can see it calculates the number of runs here: tasks times configs times
> tries.
>
> One more small thing that matters a lot: the runs don't go config by config.
> They're mixed together in a random order. Why? Because if the model provider
> gets slow for ten minutes, or starts rate-limiting us, that should hit both
> configs equally — not just whichever one happened to run last.
>
> _Open the small running experiment._
>
> And here's one I started just before recording. You can see the progress
> updating live as runs finish. The numbers on this page update too, and
> they're marked as provisional until it's done."

### A6. The answer: better, worse, or the same? (about 2 minutes)

_This is the most important part of the video. Slow down here._

**Show:** open **Model swap: gpt-oss 20B → 120B**. Point at the result card,
then scroll down to the two charts.

**Say:**

> "OK, this is the heart of the whole thing. Let me show you two real
> experiments I ran.
>
> The first one is a simple question: if I switch the agent from a 20-billion
> parameter model to a 120-billion one, and change nothing else, does it get
> better?
>
> This ran 72 real runs. Twelve tasks, two models, three tries each.
>
> The bigger model did pass more — about 5.6 points more. So if you only looked
> at that number, you'd say 'great, the big model is better, let's switch.'
>
> But look at this range. The 95% range goes from about minus 8 to plus 19.
> That means the real difference could be negative — the big model could even
> be a bit worse. The range includes zero. And the p-value is 0.63, which
> basically means a difference this size could easily be luck.
>
> So the honest answer is: **no detectable difference.**
>
> And I really wanted the platform to be honest here, not to just say 'not
> significant' and stop. So it also tells you the smallest difference this
> experiment could have noticed — about 16 points. In other words: 'with only
> twelve tasks, I can't see a difference smaller than that.' That's a very
> different message from 'these two models are equal.'
>
> _Scroll to the charts._
>
> These charts show the same thing visually. Each dot is the pass rate, and
> the bar around it is the range. And here's the difference from the baseline,
> with a line at zero — if the bar crosses that line, we can't be sure."

_Now open **Memory & skills on vs off**._

> "Now compare that with the second experiment. Same 120-billion model, but
> this time I turned on memory and skills, and ran it on tasks that need that
> knowledge — like 'write the commit message in our team's format', or 'check
> these invoice IDs using our company rules'.
>
> And here the answer is completely different. Plus 70 points. The range is
> far away from zero, the p-value is 0.004, and it won 9 tasks, lost none.
>
> And just as important — these two control tasks, which don't need memory or
> skills at all, didn't change. So we know turning these on didn't break
> anything else.
>
> So these two experiments together show the platform can do both: say 'we
> can't tell' when the evidence is weak, and say 'yes, this is clearly better'
> when it's real."

### A7. Where does the difference come from? (about 45 seconds)

**Show:** go back to **Model swap**. Scroll to **Results per task**. Click a
cell where the two configs differ, like **Clean and convert users CSV**.

**Say:**

> "Let's go back to the model experiment for a second, because there's a nice
> lesson here.
>
> This table shows every task, and how many times each model passed it. And
> you can see why we got 'no difference': most of these tasks were passed by
> both models every single time. Three out of three, three out of three.
>
> When both models always pass, that task tells us nothing about which one is
> better. So really, only four tasks were doing the work. That's a finding
> about the test suite itself — it's too easy to separate these two models.
> The fix is harder tasks, not more runs.
>
> If I click a cell, the runs below are filtered to just those runs."

### A8. Why did a run fail? (about 1 minute)

**Show:** click a **failed** run in the run list. Point at the red summary line,
then the **Checks**. Then expand one or two tool calls in **Steps**. Then
scroll to **Files after the run** and click a file.

**Say:**

> "The last big question is: when a run fails, why did it fail?
>
> So let me open a failed run. Right at the top, there's one line that tells
> you what went wrong — which check failed and why.
>
> Below that are all the checks, each with a reason in plain words, and the
> evidence — like the actual test output.
>
> On the right are the steps. This is everything the agent did, in order.
> _Expand a tool call._ Here it searched for a file, here it read it, here it
> ran a command — and you can see the exact input and output of every tool
> call, and how long it took.
>
> And down here are the files the agent left behind, marked as new or edited.
> You can open any of them.
>
> So when something fails, you don't have to guess. You can see exactly what
> the agent tried and where it went wrong."

### A9. Cost (about 30 seconds)

**Show:** open either experiment and scroll to **Cost and speed**.

**Say:**

> "One last thing on the app: cost. The platform tracks tokens, cost and time
> per run, and also per _passed_ run, which is the number that really matters.
>
> Both of these experiments together cost about forty cents at list prices.
> I actually paid nothing, because I used free Ollama Cloud models — but the
> platform works with any provider Hermes supports."

---

## Part B — the code

**Say first:**

> "Alright, now let me quickly show you some of the code. I won't go through
> everything — just the few places where I made the important decisions."

### B1. How Hermes is run (about 45 seconds)

**Open:** `apps/api/src/execution/hermes/hermes-home.ts`

**Highlight:** the function `buildHermesArgs` (around **line 124**), the lines
with `'chat', '--oneshot', '--format', 'stream-json'`.

**Say:**

> "First, how I actually run Hermes. Hermes can be used as a Python library or
> as a command-line tool. I chose the command line, in its official one-shot
> mode, with JSON output.
>
> Why? Because with this mode, every step the agent takes comes back as one
> line of JSON — so I get the full list of steps for free. Hermes also writes
> token usage and cost to a file. And every run is its own process, so runs
> can't interfere with each other. Hermes' own docs also say the Python
> internals change often, while this mode is meant for scripts."

**Then highlight:** in `buildHermesConfig` (around **line 40**), the lines with
`background_review: { enabled: false }` and `title_generation: { enabled: false }`.

> "And here's the config I generate for each run. Hermes has some background
> features — like a step that reviews the conversation afterwards to learn
> from it. That's great for a normal user, but in a test it adds cost and
> randomness that has nothing to do with the task. So anything we're _not_
> testing, I turn off."

### B2. Every run is isolated (about 40 seconds)

**Open:** `apps/api/src/execution/hermes/hermes-cli.runner.ts`

**Highlight:** the `buildEnv` function (around **lines 122–140**), especially
`HERMES_HOME: dirs.home` and `HERMES_WRITE_SAFE_ROOT: dirs.workspace`.

**Say:**

> "This is how each run stays separate. Each run gets its own Hermes home —
> that's where its memory and skills live — and its own working folder.
>
> And this line here tells Hermes it's only allowed to write files inside that
> folder.
>
> Also, the agent can run shell commands, so I'm careful about what it can
> see. It only gets the environment variables it really needs, and only the
> one API key for its own model. No other secrets."

### B3. Provider errors are not the agent's fault (about 40 seconds)

**Open:** `apps/api/src/execution/hermes/usage.ts`

**Highlight:** the function `classifyOutcome` (around **line 118**), especially
`if (isInfraError(error))` and the check for "failed before a single model
call" (around **line 145**).

**Say:**

> "This one is small but important. Sometimes a run fails, but it's not the
> agent's fault — the provider is down, or we hit a rate limit. If I counted
> those as failures, a model could look worse just because its provider had a
> bad day.
>
> So those runs are retried, and if they still fail, they're left out of the
> statistics and shown as a warning.
>
> And this second rule — 'failed before making a single model call' — I
> actually found while testing. At one point a Hermes setting was wrong, the
> run failed instantly, and it was being counted as the agent failing. Now
> that's treated as a setup problem instead."

### B4. The statistics (about 1 minute)

_This is the part reviewers care about most. Take your time._

**Open:** `apps/api/src/analysis/stats.ts`

**Highlight:** the comment at the top of the file (lines 1–12). Then the
function `signFlipTest` (around **line 168**).

**Say:**

> "And here's the statistics, which is really the core of the assignment.
>
> The key idea is in this comment. If the same task runs three times, those
> three results are not independent — it's the same prompt, the same
> difficulty. So if I treated 72 runs as 72 separate results, I'd be way too
> confident. Instead, I count by task, and I compare the two configs task by
> task.
>
> For the range, I use a bootstrap. In simple words: I pick tasks at random,
> then tries within those tasks, recalculate the result, and do that four
> thousand times. The middle 95% of those results is the range.
>
> _Point at `signFlipTest`._
>
> And for the p-value, I use this sign-flip test. The idea is simple: if the
> two configs were actually the same, then for each task, the difference
> would be just as likely to be positive as negative. So I flip the signs in
> every possible way and see how often I get a difference as big as the real
> one. It doesn't assume any bell curve, so it works fine even with a small
> number of tasks."

**Then open:** `apps/api/src/analysis/report.builder.ts`

**Highlight:** the function `decideVerdict` (around **line 278**).

> "And this is the final rule. It only says 'better' or 'worse' if two things
> are both true: the p-value is below 0.05, and the range doesn't include
> zero. Otherwise, it says 'no detectable difference'. I made it strict on
> purpose — I'd rather it say 'we can't tell' than claim an improvement that
> isn't real."

### B5. Tests (about 30 seconds)

**Open:** `apps/api/test/experiments.e2e.test.ts`

**Highlight:** the test names, the `it(...)` lines (around **lines 198–280**).

**Say:**

> "Finally, tests. There are 78 of them. This is my favourite one: it starts
> the whole backend with a fake agent, and checks the full flow — create an
> experiment, run it, score it, build the report — and also retries,
> cancelling and bad input.
>
> And on GitHub, CI runs all the tests and also builds the Docker image on
> every push."

---

## Closing (about 30 seconds)

**Show:** the README on GitHub, at the deliverables table.

**Say:**

> "So that's it. Everything is in the repo: the design document with the
> main decisions and trade-offs, the known limits, the costs, and the full
> analysis of both experiments.
>
> If I had more time, the first things I'd add are a harder task suite, a cost
> estimate before you start an experiment, and running each agent in its own
> container for stronger isolation.
>
> Thanks a lot for watching. I'd be happy to walk through any part in more
> detail."

---

## Tips

- **Speed:** talk a little slower than feels natural. On video, normal speed
  sounds rushed.
- **Pauses:** after each section, stop for one or two seconds before moving
  on. It gives the viewer time to read the screen, and it makes editing easier.
- **Mouse:** move it slowly, and point at the thing you are talking about.
- **Mistakes are fine.** If you stumble, just repeat the sentence and keep
  going. You can also record Part A and Part B as two separate videos and
  send both links.
- **If you go too long:** shorten A5 and A9 first. Keep A6, A8 and B4 — they
  matter most.
- **Upload:** save the file, upload it to Google Drive or Loom, and set the
  link to "anyone with the link can view".
