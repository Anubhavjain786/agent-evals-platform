<script setup lang="ts">
/**
 * Difference vs baseline with its 95% interval. The zero line is the
 * "no difference" reference: an interval that does not cross it is a
 * difference we can be confident about (the verdict also checks the
 * multiplicity-adjusted p-value).
 */
import { computed } from 'vue';
import { seriesColor } from '@/lib/colors';
import { pp } from '@/lib/format';

export interface ForestRow {
  key: string;
  label: string;
  colorIndex: number;
  delta: number;
  low: number;
  high: number;
}

const props = defineProps<{ rows: ForestRow[]; summary: string }>();

/** Symmetric axis rounded up to a 10 pp step, at least ±20 pp. */
const extent = computed(() => {
  const max = Math.max(
    0.2,
    ...props.rows.flatMap((r) => [r.low, r.high, r.delta].filter(Number.isFinite).map(Math.abs)),
  );
  return Math.min(1, Math.ceil(max * 10) / 10);
});
const position = (v: number) =>
  `${((Math.max(-extent.value, Math.min(extent.value, v)) + extent.value) / (2 * extent.value)) * 100}%`;
const ticks = computed(() => [-extent.value, 0, extent.value]);
</script>

<template>
  <figure :aria-label="summary">
    <div
      class="grid grid-cols-[minmax(5.5rem,11rem)_minmax(5rem,1fr)_auto] items-center gap-x-4 gap-y-3"
    >
      <template v-for="row in rows" :key="row.key">
        <div class="flex min-w-0 items-center gap-1.5 text-sm text-ink">
          <span
            class="size-2.5 shrink-0 rounded-full"
            :style="{ background: seriesColor(row.colorIndex) }"
          />
          <span class="truncate" :title="row.label">{{ row.label }}</span>
        </div>
        <div class="relative h-7">
          <div class="absolute inset-y-0 w-px bg-ink-2/60" :style="{ left: position(0) }" />
          <div class="absolute inset-x-0 top-1/2 h-px bg-line" />
          <template v-if="Number.isFinite(row.delta)">
            <div
              class="absolute top-1/2 h-0.5 -translate-y-1/2"
              :style="{
                left: position(row.low),
                width: `calc(${position(row.high)} - ${position(row.low)})`,
                background: seriesColor(row.colorIndex),
              }"
            />
            <div
              v-for="end in [row.low, row.high]"
              :key="end"
              class="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded"
              :style="{ left: position(end), background: seriesColor(row.colorIndex) }"
            />
            <div
              class="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 ring-2 ring-surface"
              :style="{ left: position(row.delta), background: seriesColor(row.colorIndex) }"
              :title="`${row.label}: ${pp(row.delta)} (95% CI ${pp(row.low)} to ${pp(row.high)})`"
            />
          </template>
        </div>
        <div class="num text-right leading-tight whitespace-nowrap">
          <div class="text-sm font-semibold text-ink">{{ pp(row.delta) }}</div>
          <div class="text-[11px] text-muted">{{ pp(row.low, 0) }} to {{ pp(row.high, 0) }}</div>
        </div>
      </template>
      <div />
      <div class="relative h-4 text-[11px] text-muted">
        <span
          v-for="tick in ticks"
          :key="tick"
          class="num absolute -translate-x-1/2 whitespace-nowrap"
          :style="{ left: position(tick) }"
          >{{
            tick === 0 ? '0' : `${tick > 0 ? '+' : '−'}${Math.round(Math.abs(tick) * 100)} pp`
          }}</span
        >
      </div>
      <div />
    </div>
    <figcaption class="mt-2 text-xs text-muted">
      Pass-rate difference vs baseline in percentage points · whiskers = 95% CI · line = no
      difference
    </figcaption>
  </figure>
</template>
