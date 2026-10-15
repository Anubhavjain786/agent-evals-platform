<script setup lang="ts">
import type { ExperimentStatus, RunOutcome, RunStatus } from '@agent-evals/shared';
import { computed } from 'vue';
import Icon, { type IconName } from './Icon.vue';

const props = defineProps<{
  status: ExperimentStatus | RunStatus;
  /** For completed runs, show the outcome instead of the status. */
  outcome?: RunOutcome | null;
}>();

const STYLES: Record<string, { label: string; icon: IconName; tone: string }> = {
  pass: { label: 'Pass', icon: 'check', tone: 'text-good-ink' },
  fail: { label: 'Fail', icon: 'x', tone: 'text-critical' },
  queued: { label: 'Queued', icon: 'clock', tone: 'text-muted' },
  running: { label: 'Running', icon: 'spinner', tone: 'text-accent' },
  completed: { label: 'Completed', icon: 'check', tone: 'text-good-ink' },
  error: { label: 'Provider/setup error', icon: 'alert', tone: 'text-serious' },
  cancelled: { label: 'Cancelled', icon: 'ban', tone: 'text-muted' },
};

const style = computed(() => STYLES[props.outcome ?? props.status] ?? STYLES.queued!);
</script>

<template>
  <span
    class="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap"
    :class="style.tone"
  >
    <Icon :name="style.icon" :size="14" />
    {{ style.label }}
  </span>
</template>
