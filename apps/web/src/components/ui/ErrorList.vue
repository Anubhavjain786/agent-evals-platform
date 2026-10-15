<script setup lang="ts">
import { ApiError } from '@/api/client';
import { computed } from 'vue';

const props = defineProps<{ error: unknown; lines?: string[] }>();
const items = computed(() => {
  if (props.lines?.length) return props.lines;
  if (props.error instanceof ApiError) return [props.error.message, ...props.error.detailLines];
  if (props.error instanceof Error) return [props.error.message];
  return [];
});
</script>

<template>
  <div
    v-if="items.length"
    class="rounded-lg border border-critical/40 p-3 text-sm text-critical"
    role="alert"
  >
    <p
      v-for="(line, i) in items"
      :key="i"
      class="font-mono text-xs whitespace-pre-wrap"
      :class="{ 'font-sans text-sm font-medium': i === 0 }"
    >
      {{ line }}
    </p>
  </div>
</template>
