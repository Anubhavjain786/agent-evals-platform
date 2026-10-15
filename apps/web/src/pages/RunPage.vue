<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useRun } from '@/api/queries';
import ScoreBreakdown from '@/components/run/ScoreBreakdown.vue';
import TrajectoryTimeline from '@/components/run/TrajectoryTimeline.vue';
import WorkspaceFiles from '@/components/run/WorkspaceFiles.vue';
import CodeBlock from '@/components/ui/CodeBlock.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import QueryState from '@/components/ui/QueryState.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { useLiveRun } from '@/composables/useLiveUpdates';
import { compact, dateTime, duration, pct, usd } from '@/lib/format';

const props = defineProps<{ id: string }>();
const run = useRun(() => props.id);
const live = computed(
  () => run.data.value?.status === 'running' || run.data.value?.status === 'queued',
);
useLiveRun(() => props.id, live);

/** Why it passed or failed, in one line: the first failing required check, else the first failing check. */
const headline = computed(() => {
  const r = run.data.value;
  if (!r) return null;
  if (r.status === 'error')
    return `Provider or setup error (${r.errorKind}): ${r.errorMessage ?? 'unknown'}`;
  if (r.status !== 'completed') return null;
  const failing = r.scores.filter((s) => !s.passed);
  if (failing.length === 0) return `All ${r.scores.length} checks passed.`;
  const first = failing.find((s) => s.required) ?? failing[0]!;
  return `${failing.length} of ${r.scores.length} checks failed — ${first.scorerId}: ${first.reason}`;
});
</script>

<template>
  <QueryState :loading="run.isLoading.value" :error="run.error.value">
    <template v-if="run.data.value">
      <PageHeader :title="run.data.value.task.name">
        <template #eyebrow>
          <RouterLink
            :to="`/experiments/${run.data.value.experimentId}`"
            class="mb-1 inline-block text-xs text-muted hover:text-ink"
            >← Experiment</RouterLink
          >
        </template>
        <template #meta>
          <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <StatusBadge :status="run.data.value.status" :outcome="run.data.value.outcome" />
            <span>
              Config
              <RouterLink
                :to="`/configs/${run.data.value.config.id}`"
                class="text-ink-2 hover:text-accent"
                >{{ run.data.value.config.name }}</RouterLink
              >
            </span>
            <span>try {{ run.data.value.trial }}</span>
            <span v-if="run.data.value.attempt > 1">attempt {{ run.data.value.attempt }}</span>
            <span>{{ dateTime(run.data.value.startedAt) }}</span>
            <span v-if="run.data.value.sessionId" class="font-mono"
              >{{ run.data.value.sessionId.slice(0, 18) }}…</span
            >
          </div>
        </template>
      </PageHeader>

      <div
        v-if="headline"
        class="mb-6 flex items-start gap-2 rounded-xl border p-4 text-sm"
        :class="
          run.data.value.outcome === 'pass'
            ? 'border-good/40 text-good-ink'
            : run.data.value.status === 'error'
              ? 'border-serious/50 text-ink'
              : 'border-critical/40 text-ink'
        "
      >
        <Icon
          :name="
            run.data.value.outcome === 'pass'
              ? 'check'
              : run.data.value.status === 'error'
                ? 'alert'
                : 'x'
          "
          class="mt-0.5 shrink-0"
          :class="
            run.data.value.outcome === 'pass'
              ? ''
              : run.data.value.status === 'error'
                ? 'text-serious'
                : 'text-critical'
          "
        />
        <p>{{ headline }}</p>
      </div>

      <dl class="card mb-6 grid grid-cols-2 gap-4 p-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <dt class="label">Score</dt>
          <dd class="num text-lg font-semibold text-ink">{{ pct(run.data.value.score, 0) }}</dd>
        </div>
        <div>
          <dt class="label">Time</dt>
          <dd class="num text-lg font-semibold text-ink">
            {{ duration(run.data.value.durationMs) }}
          </dd>
        </div>
        <div>
          <dt class="label">Tool calls</dt>
          <dd class="num text-lg font-semibold text-ink">{{ run.data.value.toolCalls ?? '—' }}</dd>
        </div>
        <div>
          <dt class="label">Tokens</dt>
          <dd class="num text-lg font-semibold text-ink">
            {{ compact(run.data.value.usage?.totalTokens) }}
          </dd>
          <dd v-if="run.data.value.usage" class="num text-xs text-muted">
            {{ compact(run.data.value.usage.inputTokens) }} in ({{
              compact(run.data.value.usage.cacheReadTokens)
            }}
            cached) · {{ compact(run.data.value.usage.outputTokens) }} out
          </dd>
        </div>
        <div>
          <dt class="label">Cost</dt>
          <dd class="num text-lg font-semibold text-ink">{{ usd(run.data.value.costUsd) }}</dd>
          <dd v-if="run.data.value.usage" class="text-xs text-muted">
            {{
              run.data.value.usage.costSource === 'pricing_table'
                ? 'estimate at list prices'
                : run.data.value.usage.costSource
            }}
          </dd>
        </div>
        <div>
          <dt class="label">Why it stopped</dt>
          <dd class="text-sm font-medium break-words text-ink">
            {{ run.data.value.turnExitReason ?? run.data.value.errorKind ?? '—' }}
          </dd>
        </div>
      </dl>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div class="space-y-6">
          <section class="card p-5">
            <h2 class="mb-3 text-sm font-semibold text-ink">Checks</h2>
            <ScoreBreakdown v-if="run.data.value.scores.length" :scores="run.data.value.scores" />
            <p v-else class="text-sm text-muted">Not checked yet.</p>
          </section>
          <section class="card p-5">
            <h2 class="mb-3 text-sm font-semibold text-ink">Final answer</h2>
            <CodeBlock v-if="run.data.value.finalAnswer" :value="run.data.value.finalAnswer" />
            <p v-else class="text-sm text-muted">No final answer.</p>
          </section>
          <section class="card p-5">
            <h2 class="mb-3 text-sm font-semibold text-ink">Task</h2>
            <CodeBlock :value="run.data.value.task.prompt" max-height="14rem" />
            <p v-if="run.data.value.task.fixtures" class="mt-2 text-xs text-muted">
              Starting files from
              <span class="font-mono">evals/fixtures/{{ run.data.value.task.fixtures }}</span>
            </p>
          </section>
        </div>

        <div class="space-y-6">
          <section class="card p-5">
            <h2 class="mb-4 text-sm font-semibold text-ink">
              Steps <span class="font-normal text-muted">({{ run.data.value.events.length }})</span>
            </h2>
            <TrajectoryTimeline
              v-if="run.data.value.events.length || live"
              :events="run.data.value.events"
              :live="live"
            />
            <p v-else class="text-sm text-muted">No steps recorded.</p>
          </section>
          <section class="card p-5">
            <h2 class="mb-3 text-sm font-semibold text-ink">Files after the run</h2>
            <WorkspaceFiles :run-id="run.data.value.id" :files="run.data.value.files" />
          </section>
        </div>
      </div>

      <details class="card mt-6 p-5 text-sm">
        <summary class="cursor-pointer font-semibold text-ink">Config used and Hermes log</summary>
        <div class="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <p class="label">Agent config (as run)</p>
            <CodeBlock :value="run.data.value.config" />
          </div>
          <div>
            <p class="label">Hermes log (last lines)</p>
            <CodeBlock :value="run.data.value.logTail || '(empty)'" />
          </div>
        </div>
      </details>
    </template>
  </QueryState>
</template>
