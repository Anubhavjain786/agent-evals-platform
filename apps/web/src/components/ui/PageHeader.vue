<script setup lang="ts">
defineProps<{ title: string; subtitle?: string | null }>();
</script>

<template>
  <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div class="min-w-0">
      <slot name="eyebrow" />
      <h1 class="text-2xl font-semibold tracking-tight text-ink">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 max-w-3xl text-sm text-ink-2">{{ subtitle }}</p>
      <slot name="meta" />
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
