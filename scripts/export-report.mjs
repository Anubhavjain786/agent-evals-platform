#!/usr/bin/env node
/**
 * Exports an experiment's report from a running Agent Evals API as Markdown
 * (for humans) and JSON (for machines).
 *
 *   node scripts/export-report.mjs <experimentId> [outDir] [--api http://localhost:3000]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const apiFlag = args.indexOf('--api');
const api = apiFlag >= 0 ? args.splice(apiFlag, 2)[1] : 'http://localhost:3000';
const [experimentId, outDir = 'docs/experiments'] = args;
if (!experimentId) {
  console.error('usage: node scripts/export-report.mjs <experimentId> [outDir] [--api URL]');
  process.exit(2);
}

async function get(path) {
  const response = await fetch(`${api}/api${path}`);
  if (!response.ok) throw new Error(`GET ${path} → ${response.status} ${await response.text()}`);
  return response.json();
}

const pct = (v, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—');
const pp = (v, d = 1) =>
  Number.isFinite(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(d)} pp` : '—';
const usd = (v) =>
  Number.isFinite(v) ? (Math.abs(v) < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`) : '—';
const secs = (ms) => (Number.isFinite(ms) ? `${(ms / 1000).toFixed(1)} s` : '—');
const p = (v) => (v < 0.001 ? '< 0.001' : v.toFixed(3));
const row = (cells) => `| ${cells.join(' | ')} |`;

const [experiment, report, runs] = await Promise.all([
  get(`/experiments/${experimentId}`),
  get(`/experiments/${experimentId}/report`),
  get(`/experiments/${experimentId}/runs`),
]);
const definition = (id) => experiment.snapshot.configs.find((c) => c.id === id);

const lines = [
  `# ${experiment.name}`,
  '',
  experiment.description ? `> ${experiment.description}\n` : '',
  `- **Suite:** ${experiment.suite.name} (\`${experiment.suite.id}@${experiment.suite.version}\`), ${experiment.taskCount} tasks`,
  `- **Setup:** ${experiment.taskCount} tasks × ${experiment.configs.length} configs × ${experiment.trials} tries = ${experiment.progress.total} runs, in a mixed, repeatable order (seed ${experiment.seed})`,
  `- **Status:** ${experiment.status} — ${experiment.progress.completed} checked, ${experiment.progress.error} provider or setup errors, ${experiment.progress.cancelled} cancelled`,
  `- **Ran:** ${experiment.startedAt ?? experiment.createdAt} → ${experiment.finishedAt ?? 'in progress'}`,
  `- **Cost at list prices:** ${usd(experiment.totalCostUsd)}`,
  '',
  '## Configurations',
  '',
  row(['', 'Config', 'Model', 'Toolsets', 'Skills', 'Memory', 'Version']),
  row(['---', '---', '---', '---', '---', '---', '---']),
  ...experiment.configs.map((c) => {
    const d = definition(c.id);
    return row([
      c.id === experiment.baselineConfigId ? 'baseline' : 'candidate',
      c.name,
      `\`${d.model.provider}/${d.model.name}\``,
      d.toolsets.join(', ') || '—',
      d.skills.include.join(', ') || '—',
      d.memory.enabled ? 'on' : 'off',
      `\`${c.version}\``,
    ]);
  }),
  '',
  '## Result',
  '',
  ...report.comparisons.flatMap((c) => [
    `**${c.verdict.replaceAll('_', ' ').toUpperCase()}** — ${c.summary}`,
    '',
    row(['Metric', 'Baseline', 'Candidate', 'Difference', '95% range', 'p-value (adjusted)']),
    row(['---', '---:', '---:', '---:', '---', '---:']),
    row([
      'Pass rate',
      pct(c.passRate.baseline),
      pct(c.passRate.candidate),
      pp(c.passRate.delta),
      `${pp(c.passRate.ci.low)} to ${pp(c.passRate.ci.high)}`,
      p(c.passRate.pValueAdjusted),
    ]),
    row([
      'Average score',
      pct(c.meanScore.baseline),
      pct(c.meanScore.candidate),
      pp(c.meanScore.delta),
      `${pp(c.meanScore.ci.low)} to ${pp(c.meanScore.ci.high)}`,
      p(c.meanScore.pValueAdjusted),
    ]),
    '',
    `Tasks won / lost / tied by the candidate: **${c.wins} / ${c.losses} / ${c.ties}** (of ${c.pairedTasks} paired). ` +
      (c.minimumDetectableEffect !== null
        ? `Smallest pass-rate difference this experiment could reliably notice: ±${(c.minimumDetectableEffect * 100).toFixed(0)} pp.`
        : ''),
    '',
  ]),
  '## Results per config',
  '',
  row([
    'Config',
    'Pass rate (95% range)',
    'Average score (95% range)',
    'Checked runs',
    'Provider/setup errors',
    'Cost / run',
    'Cost / pass',
    'Time per run: average (slowest 5%)',
    'Tokens / run',
    'Tool calls / run',
  ]),
  row(['---', '---', '---', '---:', '---:', '---:', '---:', '---:', '---:', '---:']),
  ...report.configs.map((c) =>
    row([
      c.configName,
      `${pct(c.passRate.value)} (${pct(c.passRate.ci.low, 0)}–${pct(c.passRate.ci.high, 0)})`,
      `${pct(c.meanScore.value)} (${pct(c.meanScore.ci.low, 0)}–${pct(c.meanScore.ci.high, 0)})`,
      c.scoredRuns,
      c.errorRuns,
      usd(c.meanCostUsd),
      usd(c.costPerPassUsd),
      `${secs(c.meanDurationMs)} (${secs(c.p95DurationMs)})`,
      Number.isFinite(c.meanTokens) ? Math.round(c.meanTokens).toLocaleString('en') : '—',
      Number.isFinite(c.meanToolCalls) ? c.meanToolCalls.toFixed(1) : '—',
    ]),
  ),
  '',
  '## Results per task',
  '',
  'Each cell shows passed runs / checked runs. ⚠ = flaky (passed on some tries and failed on others).',
  '',
  row(['Task', 'Tags', ...experiment.configs.map((c) => c.name)]),
  row(['---', '---', ...experiment.configs.map(() => ':---:')]),
  ...report.tasks.map((t) =>
    row([
      `${t.taskName}${t.flaky ? ' ⚠' : ''}`,
      t.tags.join(', '),
      ...t.cells.map((cell) =>
        cell.runs
          ? `${cell.passes}/${cell.runs}${cell.errors ? ` (+${cell.errors} err)` : ''}`
          : '—',
      ),
    ]),
  ),
  '',
  report.warnings.length
    ? '## Things to keep in mind\n\n' + report.warnings.map((w) => `- ${w}`).join('\n') + '\n'
    : '',
  '## How the numbers are calculated',
  '',
  report.method,
  '',
  `<sub>Generated ${report.generatedAt} from experiment \`${experiment.id}\` by scripts/export-report.mjs.</sub>`,
  '',
];

await mkdir(outDir, { recursive: true });
const slug = experiment.name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
const base = join(outDir, `${(experiment.startedAt ?? experiment.createdAt).slice(0, 10)}-${slug}`);
await writeFile(`${base}.md`, lines.filter((l) => l !== null).join('\n'));
await writeFile(`${base}.json`, JSON.stringify({ experiment, report, runs }, null, 2));
console.log(`Wrote ${base}.md and ${base}.json`);
