# Video of the working system

- **Automatic walkthrough (no sound, with captions, about 75 seconds):**
  [`docs/media/demo.mp4`](media/demo.mp4). It was recorded from the real
  running system with the real experiment data, using `npm run demo:record`,
  so it can be recorded again at any time.
- **Walkthrough with voice:** record it yourself using the script below
  (QuickTime or Loom, about 5 minutes).

---

# Script for the voice walkthrough (about 5 minutes)

Talk like you are showing your screen to a friend. Short sentences. Easy
words. You do not need to say it word for word. Lines in _italics_ are notes
for you, not things to say.

| Part                 | Time        |
| -------------------- | ----------- |
| 1. Hello             | 0:00 – 0:30 |
| 2. Tasks and configs | 0:30 – 1:30 |
| 3. The results       | 1:30 – 3:00 |
| 4. Why a run failed  | 3:00 – 3:40 |
| 5. The code          | 3:40 – 4:40 |
| 6. End               | 4:40 – 5:00 |

## Before you record

- [ ] Run `docker compose up --build` and open <http://localhost:3000>.
- [ ] Check that both experiments are there: "Model swap" and "Memory & skills".
- [ ] Open the project in VS Code and make the font bigger (`Cmd +` two or
      three times).
- [ ] Open these three files in VS Code tabs now: `hermes-home.ts`,
      `hermes-cli.runner.ts`, `stats.ts` (full paths in part 5).
- [ ] Close Slack and email. Turn on the microphone in QuickTime
      (**Options → Microphone**).

---

## 1. Hello (0:00 – 0:30)

**Show:** the Experiments page.

**Say:**

> "Hi, I'm Anubhav. Thanks for watching.
>
> When we change an AI agent, we want to know one thing: did it get better?
> For example, we use a bigger model, or we add a skill. Is the agent better
> now, or not?
>
> This app answers that. It gives the same tasks to two agents, many times.
> Then it tells us which one is better, and how sure we can be.
>
> I built it with NestJS, Vue and TypeScript. It uses the real Hermes Agent.
> And you start it with one command: `docker compose up`."

## 2. Tasks and configs (0:30 – 1:30)

**Show:** **Task suites → Core agent tasks**, then open **Fix the pricing bug**.

**Say:**

> "First, the tasks. Every task has three things: a question for the agent,
> some files, and some checks. The checks decide if the agent passed or failed.
>
> In this task, the agent gets some Python code with a bug. It has to fix it.
>
> Look at these tests. Some tests are hidden. We add them only after the agent
> is done. So the agent cannot see them, and it cannot cheat."

**Show:** **Agent configs**, then open **gpt-oss 120B · +memory +skills**.

> "Next, the configs. A config is the agent setup we want to test. It has the
> model, the tools, the skills, and memory.
>
> This one has memory turned on. It already knows a few facts, like our
> database address. It also has some team skills.
>
> Every run starts fresh, so one run never affects another run.
>
> And we run every task three times. Why? Because an agent can pass a task one
> time and fail it the next time. With only one try, we would partly measure
> luck."

## 3. The results (1:30 – 3:00)

_This is the most important part. Go slow here._

**Show:** open **Model swap: gpt-oss 20B → 120B**. Point at the result card.

**Say:**

> "Now the results. I ran two real tests.
>
> Test one: I changed the model from a small one to a big one. Nothing else.
> That was 72 runs.
>
> The big model did a little better — about 5 points. So it looks better, right?
>
> But look here. The range goes from minus 8 to plus 19. So the real difference
> could even be below zero. And the p-value is 0.63. That means this difference
> can easily be just luck.
>
> So the honest answer is: **we cannot see a real difference.**
>
> The app also tells us something useful. With these 12 tasks, it can only see
> a difference of about 16 points or more. So it does not say 'they are the
> same'. It says 'we need more tasks to know'."

**Show:** open **Memory & skills on vs off**.

> "Test two: same model, but now with memory and skills turned on.
>
> Here the answer is very clear. It got 70 points better. The range is far
> from zero, and the p-value is very small, 0.004. So this is not luck.
>
> And these two tasks here don't need memory at all. They did not change. So
> turning memory on did not break anything.
>
> So the app can say 'we don't know yet', and it can also say 'yes, this is
> really better'."

## 4. Why a run failed (3:00 – 3:40)

**Show:** in the list of runs, click a **failed** run. Point at the red line at
the top. Open one step in **Steps**. Then show **Files after the run**.

**Say:**

> "We can also see why a run failed.
>
> At the top, it says which check failed and why.
>
> Here we see every step the agent took. What it did, what it got back, and how
> long it took.
>
> And here are the files the agent made or changed. So we don't have to guess
> what went wrong."

## 5. The code (3:40 – 4:40)

**Say first:** "Now, a quick look at the code. Just three files."

**Open:** `apps/api/src/execution/hermes/hermes-home.ts` — highlight
`buildHermesArgs` (around **line 124**), the lines with `'--oneshot'` and
`'stream-json'`.

> "Here I start Hermes. I use its official command line mode. It sends back
> every step as a small piece of JSON. So I can save every step. And every run
> is its own separate process."

**Open:** `apps/api/src/execution/hermes/hermes-cli.runner.ts` — highlight
`HERMES_HOME` and `HERMES_WRITE_SAFE_ROOT` (around **lines 135–138**).

> "Here every run gets its own folder. The agent can only write files inside
> that folder. And it only gets its own API key, nothing else."

**Open:** `apps/api/src/analysis/stats.ts` — highlight the comment at the top
(lines 1–12), then `signFlipTest` (around **line 168**).

> "And this is the maths. Three tries of the same task are not three different
> results. So I count each task once, and I compare the two agents task by
> task.
>
> To find the p-value, I ask: if the two agents were really the same, how often
> would we see a difference this big just by luck? If it happens often, the
> difference is not real."

## 6. End (4:40 – 5:00)

**Show:** the README on GitHub, at the deliverables table.

**Say:**

> "Everything is in the repo: the design, the limits, the costs, and the
> results of both tests. There are 78 tests, and they run on GitHub every time
> I push code.
>
> Thanks for watching. I'm happy to explain any part in more detail."

---

## Tips

- **Talk slowly.** Slower than feels normal. On video, normal speed sounds fast.
- **Stop for one second** between parts.
- **Move the mouse slowly** and point at what you are talking about.
- **Over 5 minutes?** Make part 2 shorter. Keep part 3 as it is.
- **Made a mistake?** Just say the sentence again and keep going.
- **Upload:** save the file, put it on Google Drive or Loom, and set the link to
  "anyone with the link can view".
