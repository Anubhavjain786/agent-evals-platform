# Video of the working system

- **Automatic walkthrough (no sound, with captions, about 75 seconds):**
  [`docs/media/demo.mp4`](media/demo.mp4). It was recorded from the real
  running system with the real experiment data, using `npm run demo:record`
  (headless Chrome + ffmpeg), so it can be recorded again at any time.
- **Walkthrough with voice:** record it yourself using the script below
  (QuickTime or Loom, about 5 minutes).

---

# Script for the voice walkthrough (about 5 minutes)

Talk like you are sharing your screen with a colleague: relaxed and friendly.
Do not read it word for word. Read each part once, then say it in your own
words. Lines in _italics_ are notes for you, not things to say.

| Part                 | Time        |
| -------------------- | ----------- |
| 1. Introduction      | 0:00 – 0:30 |
| 2. Tasks and configs | 0:30 – 1:30 |
| 3. The results       | 1:30 – 3:00 |
| 4. Why a run failed  | 3:00 – 3:40 |
| 5. The code          | 3:40 – 4:40 |
| 6. Closing           | 4:40 – 5:00 |

## Before you record

- [ ] Run `docker compose up --build` and open <http://localhost:3000>.
- [ ] Check that both experiments are there: "Model swap" and "Memory & skills".
- [ ] Open the project in VS Code and make the font bigger (`Cmd +` two or
      three times).
- [ ] Open these three files in VS Code tabs now, so you can switch quickly:
      `hermes-home.ts`, `hermes-cli.runner.ts`, `stats.ts` (paths in part 5).
- [ ] Close Slack, email and notifications. Turn on the microphone in
      QuickTime (**Options → Microphone**).

---

## 1. Introduction (0:00 – 0:30)

**Show:** the Experiments page.

**Say:**

> "Hi, I'm Anubhav, thanks for watching.
>
> When we change an AI agent — a new model, a new skill, or turning on memory —
> someone always asks: _did it actually get better?_ Usually the answer is a
> gut feeling.
>
> So I built a platform that answers that with real evidence. It runs the same
> tasks with different agent setups, many times, and tells you: better, worse,
> or no difference — and how sure we can be. It's NestJS, Vue 3 and TypeScript,
> running on the real Hermes Agent, and it starts with one command:
> `docker compose up`."

## 2. Tasks and configs (0:30 – 1:30)

**Show:** **Task suites → Core agent tasks**, open **Fix the pricing bug**.

**Say:**

> "Everything starts with tasks. Each task has a prompt, some starting files,
> and checks that decide pass or fail.
>
> In this one, the agent gets a small Python project with a bug. The nice part
> is these hidden tests — they're copied in only _after_ the agent finishes,
> so the agent can't see them or cheat."

**Show:** **Agent configs**, open **gpt-oss 120B · +memory +skills**.

> "Then there are configs — the thing we're testing. The model, the tools, the
> skills, and memory. This one has memory turned on with a few facts already
> in it, and some team skills.
>
> Every run gets a brand-new Hermes setup from its config, so runs never
> affect each other. And each task runs three times, because agents can pass
> once and fail the next time — one try would partly measure luck."

## 3. The results (1:30 – 3:00)

_This is the most important part. Slow down here._

**Show:** open **Model swap: gpt-oss 20B → 120B**. Point at the result card,
then scroll down a little to the charts.

**Say:**

> "Here are two real experiments. First: I switched from a 20-billion to a
> 120-billion parameter model, and changed nothing else. 72 real runs.
>
> The bigger model passed about 5.6 points more. So you'd think: great, it's
> better. But look at the range — from minus 8 to plus 19. It includes zero,
> and the p-value is 0.63. So the honest answer is: **no detectable
> difference.**
>
> And it doesn't just stop there. It also says the smallest difference this
> experiment could have noticed is about 16 points. So it's not saying the
> models are equal — it's saying 'with twelve tasks, I can't tell.'"

**Show:** open **Memory & skills on vs off**.

> "Now the second one: same model, but with memory and skills turned on, on
> tasks that need that knowledge.
>
> And here it's very clear: plus 70 points, the range is far from zero, the
> p-value is 0.004. And these two control tasks didn't change, so nothing else
> broke.
>
> So the platform can say 'we can't tell' when the evidence is weak, and 'yes,
> this is better' when it's real."

## 4. Why a run failed (3:00 – 3:40)

**Show:** in the runs list, click a **failed** run. Point at the red line at
the top, then expand one tool call in **Steps**, then show **Files after the
run**.

**Say:**

> "And when a run fails, you can see exactly why. At the top: which check
> failed, in plain words. Here are all the steps the agent took — every tool
> call with its input and output. And here are the files it left behind. So
> you don't have to guess what went wrong."

## 5. The code (3:40 – 4:40)

**Say first:** "Let me quickly show three places in the code."

**Open:** `apps/api/src/execution/hermes/hermes-home.ts` — highlight
`buildHermesArgs` (around **line 124**), the lines with `'--oneshot'` and
`'stream-json'`.

> "First, I run Hermes in its official one-shot mode with JSON output. So
> every step the agent takes comes back as one JSON line, and every run is its
> own process."

**Open:** `apps/api/src/execution/hermes/hermes-cli.runner.ts` — highlight
`HERMES_HOME` and `HERMES_WRITE_SAFE_ROOT` (around **lines 135–138**).

> "Here each run gets its own Hermes home and its own folder, and Hermes can
> only write inside that folder. It also gets only its own API key, no other
> secrets."

**Open:** `apps/api/src/analysis/stats.ts` — highlight the comment at the top
(lines 1–12), then `signFlipTest` (around **line 168**).

> "And this is the statistics. Three tries of the same task aren't really
> three separate results, so I count by task and compare the configs task by
> task. The p-value comes from a sign-flip test: if the two configs were the
> same, each task's difference would be just as likely to be positive or
> negative. It works even with a small number of tasks."

## 6. Closing (4:40 – 5:00)

**Show:** the README on GitHub, at the deliverables table.

**Say:**

> "Everything is in the repo — the design document, known limits, costs, and
> the full analysis of both experiments. There are 78 tests, and CI runs them
> with the Docker build on every push.
>
> Thanks for watching — happy to go deeper into any part."

---

## Tips

- **Talk a little slower than feels natural.** On video, normal speed sounds
  rushed.
- **Pause one second between parts.** It looks calmer and makes editing easier.
- **Move the mouse slowly** and point at what you are talking about.
- **If you are over 5 minutes:** shorten part 2 first. Keep part 3 as it is.
- **Mistakes are fine.** Repeat the sentence and keep going.
- **Upload:** save the file, upload it to Google Drive or Loom, and set the
  link to "anyone with the link can view".
