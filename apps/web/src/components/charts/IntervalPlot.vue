<script setup lang="ts">
/**
 * Point estimate with its confidence interval per config, on a fixed 0–100%
 * axis. Values are always printed (never tooltip-only); the whisker shows the
 * 95% interval.
 */
import { seriesColor } from '@/lib/colors';
import { pct } from '@/lib/format';

export interface IntervalRow {
  key: string;
  label: string;
  colorIndex: number;
  value: number;
  low: number;
  high: number;
  baseline?: boolean;
}

defineProps<{ rows: IntervalRow[]; summary: string }>();

const TICKS = [0, 0.5, 1];
const position = (v: number) => `${Math.min(100, Math.max(0, v * 100))}%`;
const finite = (v: number) => Number.isFinite(v);
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
        <div class="relative h-6">
          <div class="absolute inset-x-0 top-1/2 h-px bg-line" />
          <template v-if="finite(row.value)">
            <div
              class="group absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-35"
              :style="{
                left: position(row.low),
                width: `calc(${position(row.high)} - ${position(row.low)})`,
                background: seriesColor(row.colorIndex),
              }"
              :title="`95% CI ${pct(row.low)} – ${pct(row.high)}`"
            />
            <div
              class="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
              :style="{ left: position(row.value), background: seriesColor(row.colorIndex) }"
              :title="`${row.label}: ${pct(row.value)} (95% CI ${pct(row.low)} – ${pct(row.high)})`"
            />
          </template>
        </div>
        <div class="num text-right leading-tight whitespace-nowrap">
          <div class="text-sm font-semibold text-ink">{{ pct(row.value) }}</div>
          <div class="text-[11px] text-muted">{{ pct(row.low, 0) }}–{{ pct(row.high, 0) }}</div>
        </div>
      </template>
      <div />
      <div class="relative h-4 text-[11px] text-muted">
        <span
          v-for="tick in TICKS"
          :key="tick"
          class="num absolute -translate-x-1/2"
          :style="{ left: position(tick) }"
          >{{ tick * 100 }}%</span
        >
      </div>
      <div />
    </div>
    <figcaption class="mt-2 text-xs text-muted">
      Dot = estimate · bar = 95% confidence interval
    </figcaption>
  </figure>
</template>
