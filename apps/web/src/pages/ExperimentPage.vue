<script setup lang="ts">
import type { RunListQuery } from '@agent-evals/shared';
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useExperiment, useExperimentActions, useReport, useRuns } from '@/api/queries';
import ForestPlot, { type ForestRow } from '@/components/charts/ForestPlot.vue';
import IntervalPlot, { type IntervalRow } from '@/components/charts/IntervalPlot.vue';
import TaskMatrix from '@/components/charts/TaskMatrix.vue';
import ErrorList from '@/components/ui/ErrorList.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import ProgressBar from '@/components/ui/ProgressBar.vue';
import QueryState from '@/components/ui/QueryState.vue';
import SeriesDot from '@/components/ui/SeriesDot.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import VerdictBadge from '@/components/ui/VerdictBadge.vue';
import { useLiveExperiment } from '@/composables/useLiveUpdates';
import {
  compact,
  dateTime,
  duration,
  pct,
  pp,
  pValue,
  signedDuration,
  signedUsd,
  usd,
} from '@/lib/format';

const props = defineProps<{ id: string }>();
const router = useRouter();

const experiment = useExperiment(() => props.id);
const report = useReport(() => props.id);
const filters = ref<RunListQuery>({});
const runs = useRuns(() => props.id, filters);
const actions = useExperimentActions(() => props.id);

const active = computed(() => ['queued', 'running'].includes(experiment.data.value?.status ?? ''));
useLiveExperiment(() => props.id, active);

const configIndex = computed(
  () => new Map((experiment.data.value?.configs ?? []).map((c, i) => [c.id, i] as const)),
);
const configName = (id: string) =>
  experiment.data.value?.configs.find((c) => c.id === id)?.name ?? id;
const taskName = (id: string) =>
  experiment.data.value?.snapshot.suite.tasks.find((t) => t.id === id)?.name ?? id;

const passRateRows = computed<IntervalRow[]>(() =>
  (report.data.value?.configs ?? []).map((c) => ({
    key: c.configId,
    label: c.configName,
    colorIndex: configIndex.value.get(c.configId) ?? 0,
    value: c.passRate.value,
    low: c.passRate.ci.low,
    high: c.passRate.ci.high,
  })),
);
const scoreRows = computed<IntervalRow[]>(() =>
  (report.data.value?.configs ?? []).map((c) => ({
    key: c.configId,
    label: c.configName,
    colorIndex: configIndex.value.get(c.configId) ?? 0,
    value: c.meanScore.value,
    low: c.meanScore.ci.low,
    high: c.meanScore.ci.high,
  })),
);
const forestRows = computed<ForestRow[]>(() =>
  (report.data.value?.comparisons ?? []).map((c) => ({
    key: c.candidateConfigId,
    label: configName(c.candidateConfigId),
    colorIndex: configIndex.value.get(c.candidateConfigId) ?? 0,
    delta: c.passRate.delta,
    low: c.passRate.ci.low,
    high: c.passRate.ci.high,
  })),
);

const hasRetryable = computed(() => {
  const p = experiment.data.value?.progress;
  return !active.value && !!p && p.error + p.cancelled > 0;
});
const selectedCell = computed(() =>
  filters.value.taskId && filters.value.configId
    ? { taskId: filters.value.taskId, configId: filters.value.configId }
    : null,
);
const actionError = computed(
  () => actions.cancel.error.value ?? actions.retry.error.value ?? actions.remove.error.value,
);

function selectCell(cell: { taskId: string; configId: string }) {
  const same =
    selectedCell.value?.taskId === cell.taskId && selectedCell.value?.configId === cell.configId;
  filters.value = same ? {} : { ...cell };
  document.getElementById('runs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function remove() {
  if (!window.confirm('Delete this experiment and all of its runs? This cannot be undone.')) return;
  await actions.remove.mutateAsync();
  await router.push('/experiments');
}
</script>

<template>
  <QueryState :loading="experiment.isLoading.value" :error="experiment.error.value">
    <template v-if="experiment.data.value">
      <PageHeader :title="experiment.data.value.name" :subtitle="experiment.data.value.description">
        <template #eyebrow>
          <RouterLink to="/experiments" class="mb-1 inline-block text-xs text-muted hover:text-ink"
            >← Experiments</RouterLink
          >
        </template>
        <template #meta>
          <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <StatusBadge :status="experiment.data.value.status" />
            <span>
              Suite
              <RouterLink
                :to="`/suites/${experiment.data.value.suite.id}`"
                class="text-ink-2 hover:text-accent"
                >{{ experiment.data.value.suite.name }}</RouterLink
              >
              <span class="font-mono text-[11px]">
                v{{ experiment.data.value.suite.version.slice(0, 7) }}</span
              >
            </span>
            <span
              >{{ experiment.data.value.taskCount }} tasks ×
              {{ experiment.data.value.configs.length }} configs ×
              {{ experiment.data.value.trials }} trials</span
            >
            <span>seed {{ experiment.data.value.seed }}</span>
            <span
              >started
              {{
                dateTime(experiment.data.value.startedAt ?? experiment.data.value.createdAt)
              }}</span
            >
            <span class="num">spent {{ usd(experiment.data.value.totalCostUsd) }}</span>
          </div>
        </template>
        <template #actions>
          <button
            v-if="active"
            class="btn-secondary"
            :disabled="actions.cancel.isPending.value"
            @click="actions.cancel.mutate()"
          >
            <Icon name="ban" :size="15" />Cancel
          </button>
          <button
            v-if="hasRetryable"
            class="btn-secondary"
            :disabled="actions.retry.isPending.value"
            @click="actions.retry.mutate()"
          >
            <Icon name="refresh" :size="15" />Retry failed runs
          </button>
          <button
            v-if="!active"
            class="btn-danger"
            :disabled="actions.remove.isPending.value"
            @click="remove"
          >
            <Icon name="trash" :size="15" />Delete
          </button>
        </template>
      </PageHeader>

      <ErrorList :error="actionError" class="mb-4" />

      <section class="card mb-6 p-4">
        <ProgressBar :progress="experiment.data.value.progress" />
      </section>

      <template v-if="report.data.value">
        <ul v-if="report.data.value.warnings.length" class="mb-6 space-y-1.5">
          <li
            v-for="warning in report.data.value.warnings"
            :key="warning"
            class="flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-2"
          >
            <Icon name="alert" class="mt-0.5 shrink-0 text-serious" :size="15" />{{ warning }}
          </li>
        </ul>

        <!-- Verdicts: the answer to "is it better, and how sure are we?" -->
        <section
          class="mb-6 grid gap-4"
          :class="report.data.value.comparisons.length > 1 ? 'lg:grid-cols-2' : ''"
        >
          <article
            v-for="c in report.data.value.comparisons"
            :key="c.candidateConfigId"
            class="card p-5"
          >
            <div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <SeriesDot
                :index="configIndex.get(c.candidateConfigId) ?? 0"
                :label="configName(c.candidateConfigId)"
                class="font-medium"
              />
              <span class="text-muted">vs</span>
              <SeriesDot
                :index="configIndex.get(c.baselineConfigId) ?? 0"
                :label="configName(c.baselineConfigId)"
                baseline
              />
              <VerdictBadge :verdict="c.verdict" class="ml-auto" />
            </div>
            <p class="mb-4 text-sm leading-relaxed text-ink">{{ c.summary }}</p>
            <dl
              v-if="c.verdict !== 'insufficient_data'"
              class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4"
            >
              <div>
                <dt class="label">Δ pass rate</dt>
                <dd class="num text-lg font-semibold text-ink">{{ pp(c.passRate.delta) }}</dd>
                <dd class="num text-xs text-muted">
                  95% CI {{ pp(c.passRate.ci.low, 0) }} to {{ pp(c.passRate.ci.high, 0) }}
                </dd>
              </div>
              <div>
                <dt class="label">p-value</dt>
                <dd class="num text-lg font-semibold text-ink">
                  {{ pValue(c.passRate.pValueAdjusted) }}
                </dd>
                <dd class="text-xs text-muted">
                  Holm-adjusted · raw {{ pValue(c.passRate.pValue) }}
                </dd>
              </div>
              <div>
                <dt class="label">Tasks W / L / T</dt>
                <dd class="num text-lg font-semibold text-ink">
                  {{ c.wins }} / {{ c.losses }} / {{ c.ties }}
                </dd>
                <dd class="text-xs text-muted">by mean score, {{ c.pairedTasks }} paired</dd>
              </div>
              <div>
                <dt class="label">Detectable effect</dt>
                <dd class="num text-lg font-semibold text-ink">
                  {{
                    c.minimumDetectableEffect === null
                      ? '—'
                      : `±${(c.minimumDetectableEffect * 100).toFixed(0)} pp`
                  }}
                </dd>
                <dd class="text-xs text-muted">at 80% power</dd>
              </div>
              <div>
                <dt class="label">Δ mean score</dt>
                <dd class="num font-medium text-ink">{{ pp(c.meanScore.delta) }}</dd>
                <dd class="num text-xs text-muted">p {{ pValue(c.meanScore.pValueAdjusted) }}</dd>
              </div>
              <div>
                <dt class="label">Δ cost / run</dt>
                <dd class="num font-medium text-ink">{{ signedUsd(c.costDeltaUsd) }}</dd>
              </div>
              <div>
                <dt class="label">Δ latency / run</dt>
                <dd class="num font-medium text-ink">{{ signedDuration(c.durationDeltaMs) }}</dd>
              </div>
            </dl>
          </article>
        </section>

        <section class="mb-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <article class="card p-5">
            <h2 class="mb-4 text-sm font-semibold text-ink">Pass rate by config</h2>
            <IntervalPlot
              :rows="passRateRows"
              summary="Pass rate by configuration with 95% confidence intervals"
            />
          </article>
          <article v-if="forestRows.length" class="card p-5">
            <h2 class="mb-4 text-sm font-semibold text-ink">Difference vs baseline</h2>
            <ForestPlot
              :rows="forestRows"
              summary="Pass-rate difference versus baseline with 95% confidence intervals"
            />
          </article>
          <article class="card p-5">
            <h2 class="mb-4 text-sm font-semibold text-ink">
              Mean score by config <span class="font-normal text-muted">(partial credit)</span>
            </h2>
            <IntervalPlot
              :rows="scoreRows"
              summary="Mean score by configuration with 95% confidence intervals"
            />
          </article>
          <article class="card overflow-x-auto p-5 lg:col-span-2 xl:col-span-3">
            <h2 class="mb-3 text-sm font-semibold text-ink">Cost &amp; efficiency</h2>
            <table class="table">
              <thead>
                <tr>
                  <th>Config</th>
                  <th class="text-right">Scored</th>
                  <th class="text-right">Cost / run</th>
                  <th class="text-right">Cost / pass</th>
                  <th class="text-right">Latency (p95)</th>
                  <th class="text-right">Tokens</th>
                  <th class="text-right">Tool calls</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in report.data.value.configs" :key="c.configId">
                  <td>
                    <SeriesDot
                      :index="configIndex.get(c.configId) ?? 0"
                      :label="c.configName"
                      :baseline="c.configId === report.data.value.baselineConfigId"
                    />
                  </td>
                  <td class="num text-right">
                    {{ c.scoredRuns
                    }}<span v-if="c.errorRuns" class="text-serious"> +{{ c.errorRuns }}⚠</span>
                  </td>
                  <td class="num text-right">{{ usd(c.meanCostUsd) }}</td>
                  <td class="num text-right">{{ usd(c.costPerPassUsd) }}</td>
                  <td class="num text-right whitespace-nowrap">
                    {{ duration(c.meanDurationMs) }}
                    <span class="text-muted">({{ duration(c.p95DurationMs) }})</span>
                  </td>
                  <td class="num text-right">{{ compact(c.meanTokens) }}</td>
                  <td class="num text-right">{{ c.meanToolCalls?.toFixed(1) ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </article>
        </section>

        <section class="card mb-6 p-5">
          <h2 class="mb-1 text-sm font-semibold text-ink">Per-task results</h2>
          <p class="mb-4 text-xs text-muted">
            Where the configs differ. Click a cell to inspect its runs.
          </p>
          <TaskMatrix
            :tasks="report.data.value.tasks"
            :configs="experiment.data.value.configs"
            :baseline-config-id="experiment.data.value.baselineConfigId"
            :selected="selectedCell"
            @select="selectCell"
          />
        </section>
      </template>

      <section id="runs" class="card mb-6 scroll-mt-20 p-5">
        <div class="mb-4 flex flex-wrap items-end gap-3">
          <h2 class="mr-auto text-sm font-semibold text-ink">Runs</h2>
          <label class="text-xs">
            <span class="label">Config</span>
            <select v-model="filters.configId" class="input py-1.5">
              <option :value="undefined">All</option>
              <option v-for="c in experiment.data.value.configs" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
          </label>
          <label class="text-xs">
            <span class="label">Task</span>
            <select v-model="filters.taskId" class="input py-1.5">
              <option :value="undefined">All</option>
              <option
                v-for="t in experiment.data.value.snapshot.suite.tasks"
                :key="t.id"
                :value="t.id"
              >
                {{ t.name }}
              </option>
            </select>
          </label>
          <label class="text-xs">
            <span class="label">Outcome</span>
            <select v-model="filters.outcome" class="input py-1.5">
              <option :value="undefined">All</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </select>
          </label>
          <label class="text-xs">
            <span class="label">Status</span>
            <select v-model="filters.status" class="input py-1.5">
              <option :value="undefined">All</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="error">Infra error</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <button
            v-if="Object.values(filters).some(Boolean)"
            class="btn-secondary"
            @click="filters = {}"
          >
            Clear
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Config</th>
                <th class="text-right">Trial</th>
                <th>Result</th>
                <th class="text-right">Score</th>
                <th class="text-right">Duration</th>
                <th class="text-right">Tokens</th>
                <th class="text-right">Tools</th>
                <th class="text-right">Cost</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="run in runs.data.value"
                :key="run.id"
                class="cursor-pointer hover:bg-surface-2/60"
                @click="router.push(`/runs/${run.id}`)"
              >
                <td>
                  <RouterLink
                    :to="`/runs/${run.id}`"
                    class="font-medium text-ink hover:text-accent"
                    @click.stop
                    >{{ taskName(run.taskId) }}</RouterLink
                  >
                </td>
                <td>
                  <SeriesDot
                    :index="configIndex.get(run.configId) ?? 0"
                    :label="configName(run.configId)"
                  />
                </td>
                <td class="num text-right">
                  {{ run.trial
                  }}<span
                    v-if="run.attempt > 1"
                    class="text-xs text-muted"
                    :title="`${run.attempt} attempts`"
                  >
                    ·{{ run.attempt }}×</span
                  >
                </td>
                <td><StatusBadge :status="run.status" :outcome="run.outcome" /></td>
                <td class="num text-right">{{ pct(run.score, 0) }}</td>
                <td class="num text-right">{{ duration(run.durationMs) }}</td>
                <td class="num text-right">{{ compact(run.totalTokens) }}</td>
                <td class="num text-right">{{ run.toolCalls ?? '—' }}</td>
                <td class="num text-right">{{ usd(run.costUsd) }}</td>
                <td class="max-w-64 truncate text-xs text-muted" :title="run.errorMessage ?? ''">
                  {{ run.errorKind ? `${run.errorKind}: ` : '' }}{{ run.errorMessage }}
                </td>
              </tr>
              <tr v-if="runs.data.value?.length === 0">
                <td colspan="10" class="py-6 text-center text-sm text-muted">
                  No runs match these filters.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <details v-if="report.data.value" class="card p-5 text-sm">
        <summary class="cursor-pointer font-semibold text-ink">
          How these numbers are computed
        </summary>
        <p class="mt-3 leading-relaxed text-ink-2">{{ report.data.value.method }}</p>
        <p class="mt-3 text-xs text-muted">
          Definitions are frozen at launch: suite {{ experiment.data.value.suite.id }}@{{
            experiment.data.value.suite.version
          }};
          <template v-for="(c, i) in experiment.data.value.configs" :key="c.id"
            >{{ i ? ', ' : '' }}{{ c.id }}@{{ c.version }}</template
          >.
        </p>
      </details>
    </template>
  </QueryState>
</template>
