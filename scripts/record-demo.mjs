#!/usr/bin/env node
/**
 * Records a captioned walkthrough of the running platform as an MP4.
 *
 *   node scripts/record-demo.mjs [--url http://localhost:3000] [--out docs/media/demo.mp4] [--experiment <id>]
 *
 * Key screens are also saved as PNG screenshots next to the video.
 * Uses the locally installed Google Chrome (playwright-core, no browser
 * download) and the Chrome DevTools screencast; ffmpeg assembles the frames
 * with their real timing. The walkthrough opens the most recent completed
 * experiment, so run one first.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright-core';

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const BASE = arg('--url', 'http://localhost:3000');
const OUT = arg('--out', 'docs/media/demo.mp4');
const VIEWPORT = { width: 1440, height: 900 };

const experiments = await (await fetch(`${BASE}/api/experiments`)).json();
const requested = arg('--experiment', null);
const experiment = requested
  ? experiments.find((e) => e.id === requested)
  : (experiments.find((e) => e.status === 'completed' && e.trials > 1) ?? experiments[0]);
if (!experiment) throw new Error('No experiment found — run one first.');
const runs = await (
  await fetch(`${BASE}/api/experiments/${experiment.id}/runs?outcome=fail`)
).json();
const failedRun = runs[0];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: 'light' });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);

const frames = [];
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  frames.push({ data, ts: metadata.timestamp });
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined);
});

const pause = (ms) => page.waitForTimeout(ms);

async function shot(name) {
  await page.evaluate(() => document.getElementById('demo-caption')?.remove());
  await mkdir(dirname(OUT), { recursive: true });
  await page.screenshot({ path: join(dirname(OUT), `${name}.png`) });
}

async function caption(text) {
  await page.evaluate((value) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      Object.assign(el.style, {
        position: 'fixed',
        left: '50%',
        bottom: '28px',
        transform: 'translateX(-50%)',
        zIndex: '9999',
        background: 'rgba(17,17,16,0.88)',
        color: '#fff',
        padding: '10px 18px',
        borderRadius: '10px',
        font: '500 17px/1.4 Inter, system-ui, sans-serif',
        maxWidth: '80%',
        textAlign: 'center',
        boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
        pointerEvents: 'none',
      });
      document.body.appendChild(el);
    }
    el.textContent = value;
  }, text);
}

async function scrollTo(selectorOrY, offset = 80) {
  await page.evaluate(
    ([target, off]) => {
      const y =
        typeof target === 'number'
          ? target
          : (() => {
              const el = [...document.querySelectorAll('h2')].find((h) =>
                h.textContent?.includes(target),
              );
              return el ? el.getBoundingClientRect().top + window.scrollY - off : window.scrollY;
            })();
      window.scrollTo({ top: y, behavior: 'smooth' });
    },
    [selectorOrY, offset],
  );
  await pause(900);
}

async function go(path, text) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  if (text) await caption(text);
}

await page.goto(`${BASE}/experiments`, { waitUntil: 'networkidle' });
await cdp.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 80,
  everyNthFrame: 1,
  ...{ maxWidth: VIEWPORT.width, maxHeight: VIEWPORT.height },
});

await caption(
  'Agent Evals — is a Hermes Agent change better, worse, or the same? And how sure are we?',
);
await pause(3500);
await caption('Experiments compare agent configurations on a task suite, several trials each');
await pause(3000);

await page.getByText(experiment.name).first().click();
await page.getByText('Pass rate by config').waitFor();
await pause(800);
await shot('experiment');
await caption(
  'The verdict: effect size, 95% interval, Holm-adjusted p-value, and the detectable effect',
);
await pause(5500);

await scrollTo('Pass rate by config');
await shot('charts');
await caption(
  'Two-level bootstrap intervals per config, and the paired difference vs the baseline',
);
await pause(5000);

await scrollTo('Cost & efficiency');
await caption('Cost and latency per run and per passed task, from real token usage');
await pause(3500);

await scrollTo('Per-task results');
await shot('task-matrix');
await caption('Where the difference comes from: pass counts per task and config (⚠ = flaky)');
await pause(4500);

if (failedRun) {
  await go(`/runs/${failedRun.id}`);
  await page.getByText('Trajectory').waitFor();
  await shot('run');
  await caption('Why did this run fail? The failing check, with its evidence…');
  await pause(4500);
  await scrollTo('Trajectory', 120);
  await caption('…the full trajectory: every tool call with its arguments, output and timing…');
  const firstTool = page.locator('details summary').first();
  if (await firstTool.count()) await firstTool.click().catch(() => undefined);
  await pause(4500);
  await scrollTo('Workspace after the run', 120);
  await caption('…and the files the agent created or edited');
  await pause(3500);
}

await go(
  '/suites/core',
  'Tasks are YAML in the repo: a prompt, a workspace fixture and the checks that grade it',
);
await page.getByText('Fix the pricing bug').first().click();
await pause(4500);

await go(
  '/configs/gpt-oss-120b-memory-skills',
  'A config is the variable under test: model, toolsets, skills, memory, persona',
);
await pause(4500);

await go(
  '/experiments/new',
  'Launching an experiment: pick a suite, the configs to compare, and the trials',
);
await page.getByText('gpt-oss 20B · file+terminal').first().click();
await page.getByText('gpt-oss 120B · file+terminal').first().click();
await pause(4000);

await go(
  `/experiments/${experiment.id}`,
  'Light and dark themes, live updates over server-sent events',
);
await page.getByRole('button', { name: /Switch to dark theme/ }).click();
await pause(3500);
await caption('docker compose up --build → http://localhost:3000');
await pause(3000);

await cdp.send('Page.stopScreencast');
await browser.close();

// Assemble frames with their real timing (the screencast only emits frames on change).
const work = await mkdtemp(join(tmpdir(), 'demo-frames-'));
const list = [];
for (let i = 0; i < frames.length; i += 1) {
  const file = join(work, `f${String(i).padStart(5, '0')}.jpg`);
  await writeFile(file, Buffer.from(frames[i].data, 'base64'));
  const next = frames[i + 1]?.ts ?? frames[i].ts + 1.5;
  list.push(`file '${file}'`, `duration ${Math.max(0.02, next - frames[i].ts).toFixed(3)}`);
}
list.push(`file '${join(work, `f${String(frames.length - 1).padStart(5, '0')}.jpg`)}'`);
await writeFile(join(work, 'frames.txt'), list.join('\n'));
await mkdir(dirname(OUT), { recursive: true });
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    join(work, 'frames.txt'),
    '-vf',
    'scale=1440:-2:flags=lanczos,fps=30',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '24',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    OUT,
  ],
  { stdio: 'inherit' },
);
await rm(work, { recursive: true, force: true });
console.log(`Wrote ${OUT} (${frames.length} frames)`);
