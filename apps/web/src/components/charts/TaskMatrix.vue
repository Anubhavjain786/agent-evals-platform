<script setup lang="ts">
/**
 * Task × config heatmap of pass rates (single-hue sequential ramp), with the
 * pass count printed in every cell so colour is never the only channel.
 * Clicking a cell filters the run list to that task and config.
 */
import type { ExperimentConfigRef, TaskRow } from '@agent-evals/shared';
import { computed } from 'vue';
import Icon from '@/components/ui/Icon.vue';
import SeriesDot from '@/components/ui/SeriesDot.vue';
import { sequentialFill, sequentialInk } from '@/lib/colors';
import { pct, pp } from '@/lib/format';

const props = defineProps<{
  tasks: TaskRow[];
  configs: ExperimentConfigRef[];
  baselineConfigId: string;
  selected?: { taskId: string; configId: string } | null;
}>();
const emit = defineEmits<{ select: [cell: { taskId: string; configId: string }] }>();

/** With exactly two configs, a delta column makes per-task wins and losses scannable. */
const candidateId = computed(() =>
  props.configs.length === 2
    ? props.configs.find((c) => c.id !== props.baselineConfigId)?.id
    : undefined,
);

function delta(row: TaskRow): number | null {
  const base = row.cells.find((c) => c.configId === props.baselineConfigId)?.passRate;
  const cand = row.cells.find((c) => c.configId === candidateId.value)?.passRate;
  return base === null || base === undefined || cand === null || cand === undefined
    ? null
    : cand - base;
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="table">
      <thead>
        <tr>
          <th>Task</th>
          <th v-for="(config, index) in configs" :key="config.id" class="text-center">
            <SeriesDot :index="index" :label="config.name" class="justify-center normal-case" />
          </th>
          <th v-if="candidateId" class="text-right">Δ pass rate</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in tasks" :key="row.taskId">
          <td class="max-w-72">
            <div class="flex items-center gap-1.5 font-medium text-ink">
              <span class="truncate" :title="row.taskName">{{ row.taskName }}</span>
              <span
                v-if="row.flaky"
                class="inline-flex items-center gap-0.5 text-[11px] font-medium text-serious"
                title="Passed on some trials and failed on others"
              >
                <Icon name="alert" :size="12" />flaky
              </span>
            </div>
            <div class="mt-0.5 flex flex-wrap gap-1">
              <span
                v-for="tag in row.tags"
                :key="tag"
                class="rounded bg-surface-2 px-1.5 text-[11px] text-muted"
                >{{ tag }}</span
              >
            </div>
          </td>
          <td v-for="cell in row.cells" :key="cell.configId" class="p-1 text-center">
            <button
              type="button"
              class="num h-10 w-full min-w-20 rounded-md text-sm font-medium transition hover:ring-2 hover:ring-accent"
              :class="[
                selected?.taskId === row.taskId && selected?.configId === cell.configId
                  ? 'ring-2 ring-accent'
                  : '',
                sequentialInk(cell.passRate) === 'on-dark'
                  ? 'text-[var(--seq-ink-strong)]'
                  : 'text-ink',
              ]"
              :style="{
                background: cell.runs ? sequentialFill(cell.passRate) : 'var(--app-surface-2)',
              }"
              :title="`${row.taskName} · ${pct(cell.passRate)} pass (${cell.passes}/${cell.runs})${cell.errors ? ` · ${cell.errors} infra errors` : ''}`"
              @click="emit('select', { taskId: row.taskId, configId: cell.configId })"
            >
              <template v-if="cell.runs">{{ cell.passes }}/{{ cell.runs }}</template>
              <span v-else class="text-muted">—</span>
              <span v-if="cell.errors" class="ml-1 text-xs text-serious">+{{ cell.errors }}⚠</span>
            </button>
          </td>
          <td v-if="candidateId" class="num text-right whitespace-nowrap">
            <span
              :class="{
                'text-good-ink': (delta(row) ?? 0) > 0,
                'text-critical': (delta(row) ?? 0) < 0,
                'text-muted': !delta(row),
              }"
            >
              {{ pp(delta(row), 0) }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="mt-3 flex items-center gap-2 text-xs text-muted">
      <span>Pass rate</span>
      <span class="num">0%</span>
      <span class="flex overflow-hidden rounded">
        <span
          v-for="step in 7"
          :key="step"
          class="h-2.5 w-6"
          :style="{ background: `var(--seq-${step - 1})` }"
        />
      </span>
      <span class="num">100%</span>
      <span class="ml-2">Cells show passes / scored runs.</span>
    </div>
  </div>
</template>
