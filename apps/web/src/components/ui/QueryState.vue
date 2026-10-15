<script setup lang="ts">
import { ApiError } from '@/api/client';
import { computed } from 'vue';
import Icon from './Icon.vue';

const props = defineProps<{
  loading: boolean;
  error: unknown;
  empty?: boolean;
  emptyText?: string;
}>();
const message = computed(() =>
  props.error instanceof Error ? props.error.message : 'Something went wrong',
);
const notFound = computed(() => props.error instanceof ApiError && props.error.status === 404);
</script>

<template>
  <div v-if="loading" class="flex items-center gap-2 py-12 text-sm text-muted">
    <Icon name="spinner" /> Loading…
  </div>
  <div v-else-if="error" class="card flex items-start gap-2 p-4 text-sm text-critical" role="alert">
    <Icon name="alert" class="mt-0.5" />
    <div>
      <p class="font-medium">{{ notFound ? 'Not found' : 'Could not load data' }}</p>
      <p class="text-ink-2">{{ message }}</p>
    </div>
  </div>
  <div v-else-if="empty" class="card p-8 text-center text-sm text-muted">
    <slot name="empty">{{ emptyText ?? 'Nothing here yet.' }}</slot>
  </div>
  <slot v-else />
</template>
