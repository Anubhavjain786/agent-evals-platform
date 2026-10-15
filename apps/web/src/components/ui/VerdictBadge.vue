<script setup lang="ts">
import type { Verdict } from '@agent-evals/shared';
import { computed } from 'vue';
import Icon, { type IconName } from './Icon.vue';

const props = defineProps<{ verdict: Verdict }>();

const STYLES: Record<Verdict, { label: string; icon: IconName; classes: string }> = {
  better: { label: 'Better', icon: 'up', classes: 'text-good-ink border-good/40' },
  worse: { label: 'Worse', icon: 'down', classes: 'text-critical border-critical/40' },
  no_detectable_difference: {
    label: 'No detectable difference',
    icon: 'equal',
    classes: 'text-ink-2 border-line',
  },
  insufficient_data: {
    label: 'Insufficient data',
    icon: 'clock',
    classes: 'text-muted border-line',
  },
};
const style = computed(() => STYLES[props.verdict]);
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold"
    :class="style.classes"
  >
    <Icon :name="style.icon" :size="13" />
    {{ style.label }}
  </span>
</template>
