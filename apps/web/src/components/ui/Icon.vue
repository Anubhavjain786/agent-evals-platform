<script setup lang="ts">
/** Small inline icon set (stroke icons, 16px grid) so status never relies on colour alone. */
const PATHS = {
  check: 'M3.5 8.5l3 3 6-7',
  x: 'M4.5 4.5l7 7m0-7l-7 7',
  alert:
    'M8 5v3.5M8 11h.01M7.1 2.6L1.8 12a1 1 0 00.9 1.5h10.6a1 1 0 00.9-1.5L8.9 2.6a1 1 0 00-1.8 0z',
  clock: 'M8 4.5V8l2.5 1.5M14 8A6 6 0 112 8a6 6 0 0112 0z',
  spinner: 'M8 2a6 6 0 105.2 3',
  ban: 'M3.8 3.8l8.4 8.4M14 8A6 6 0 112 8a6 6 0 0112 0z',
  up: 'M8 13V3m0 0L4 7m4-4l4 4',
  down: 'M8 3v10m0 0l-4-4m4 4l4-4',
  equal: 'M3.5 6h9M3.5 10h9',
  flask: 'M6 2h4M6.5 2v4L2.8 12.4A1 1 0 003.7 14h8.6a1 1 0 00.9-1.6L9.5 6V2',
  list: 'M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01',
  sliders: 'M2 4h8m2 0h2M2 12h2m2 0h8M10 2v4M4 10v4',
  file: 'M9 2H4.5A1.5 1.5 0 003 3.5v9A1.5 1.5 0 004.5 14h7a1.5 1.5 0 001.5-1.5V6L9 2zm0 0v4h4',
  wrench:
    'M10.5 2.5a3 3 0 00-3.4 4.1L2.5 11.2 4.8 13.5l4.6-4.6a3 3 0 004.1-3.4l-1.8 1.8-1.7-.4-.4-1.7 1.8-1.8z',
  message: 'M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z',
  flag: 'M3.5 14V2.5m0 0h8l-1.5 3 1.5 3h-8',
  plus: 'M8 3v10M3 8h10',
  copy: 'M5.5 5.5V3.5a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1h-2m-5-5h-2a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1v-2m-5-5h4a1 1 0 011 1v4',
  refresh: 'M13.5 8A5.5 5.5 0 113 5m0-2.5V5h2.5',
  trash: 'M3 4.5h10M6.5 4.5V3h3v1.5m-5 0l.5 8.5h6l.5-8.5',
  sun: 'M8 1.5v1.5m0 10v1.5M1.5 8H3m10 0h1.5M3.4 3.4l1 1m7.2 7.2l1 1m0-9.2l-1 1m-7.2 7.2l-1 1M11 8a3 3 0 11-6 0 3 3 0 016 0z',
  moon: 'M13.5 9.5A5.5 5.5 0 016.5 2.5a5.5 5.5 0 107 7z',
  external: 'M9.5 2.5h4v4m0-4L7 9m-1.5-5H3.5a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1v-2',
  chevron: 'M6 4l4 4-4 4',
} as const;

export type IconName = keyof typeof PATHS;

defineProps<{ name: IconName; size?: number }>();
</script>

<template>
  <svg
    :width="size ?? 16"
    :height="size ?? 16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    :class="{ 'animate-spin': name === 'spinner' }"
  >
    <path :d="PATHS[name]" />
  </svg>
</template>
