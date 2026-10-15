<script setup lang="ts">
import { seriesColor } from '@/lib/colors';

defineProps<{ index: number; label?: string; baseline?: boolean }>();
</script>

<template>
  <span class="inline-flex min-w-0 items-center gap-1.5">
    <span class="size-2.5 shrink-0 rounded-full" :style="{ background: seriesColor(index) }" />
    <span v-if="label" class="truncate">{{ label }}</span>
    <span
      v-if="baseline"
      class="rounded bg-surface-2 px-1.5 py-px text-[10px] font-semibold tracking-wide text-muted uppercase"
      >baseline</span
    >
  </span>
</template>
