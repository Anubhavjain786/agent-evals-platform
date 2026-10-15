<script setup lang="ts">
import type { ExperimentProgress } from '@agent-evals/shared';
import { computed } from 'vue';

const props = defineProps<{ progress: ExperimentProgress }>();

const segments = computed(() => {
  const { total, completed, running, error, cancelled } = props.progress;
  if (total === 0) return [];
  return [
    { key: 'completed', value: completed, color: 'var(--status-good)', label: 'completed' },
    { key: 'running', value: running, color: 'var(--app-accent)', label: 'running' },
    { key: 'error', value: error, color: 'var(--status-serious)', label: 'infra errors' },
    { key: 'cancelled', value: cancelled, color: 'var(--status-neutral)', label: 'cancelled' },
  ]
    .filter((s) => s.value > 0)
    .map((s) => ({ ...s, width: `${(s.value / total) * 100}%` }));
});
const done = computed(
  () => props.progress.completed + props.progress.error + props.progress.cancelled,
);
</script>

<template>
  <div>
    <div
      class="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-surface-2"
      role="progressbar"
      :aria-valuenow="done"
      :aria-valuemax="progress.total"
    >
      <div
        v-for="s in segments"
        :key="s.key"
        class="h-full first:rounded-l-full last:rounded-r-full"
        :style="{ width: s.width, background: s.color }"
        :title="`${s.value} ${s.label}`"
      />
    </div>
    <p class="num mt-1 text-xs text-muted">
      {{ done }} / {{ progress.total }} runs
      <template v-if="progress.running"> · {{ progress.running }} running</template>
      <template v-if="progress.error"> · {{ progress.error }} infra errors</template>
      <template v-if="progress.cancelled"> · {{ progress.cancelled }} cancelled</template>
    </p>
  </div>
</template>
