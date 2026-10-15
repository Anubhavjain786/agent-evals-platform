<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useConfigs } from '@/api/queries';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import QueryState from '@/components/ui/QueryState.vue';

const configs = useConfigs();
</script>

<template>
  <PageHeader
    title="Agent configs"
    subtitle="A config is everything you might change about the agent: model, toolsets, skills, memory, persona and turn budget. Each run gets a fresh, isolated Hermes home built from its config."
  >
    <template #actions>
      <RouterLink to="/configs/new" class="btn-primary"
        ><Icon name="plus" :size="15" />New config</RouterLink
      >
    </template>
  </PageHeader>
  <QueryState
    :loading="configs.isLoading.value"
    :error="configs.error.value"
    :empty="configs.data.value?.length === 0"
  >
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <RouterLink
        v-for="c in configs.data.value"
        :key="c.id"
        :to="`/configs/${c.id}`"
        class="card block p-5 hover:border-accent"
      >
        <div class="flex items-start justify-between gap-3">
          <h2 class="font-semibold text-ink">{{ c.name }}</h2>
          <span class="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{{
            c.source === 'file' ? 'file' : 'created in UI'
          }}</span>
        </div>
        <p class="mt-1 font-mono text-xs text-muted">{{ c.model.provider }}/{{ c.model.name }}</p>
        <p v-if="c.description" class="mt-2 line-clamp-2 text-sm text-ink-2">{{ c.description }}</p>
        <dl class="mt-3 space-y-1 text-xs">
          <div class="flex gap-2">
            <dt class="w-16 text-muted">Tools</dt>
            <dd class="text-ink-2">{{ c.toolsets.join(', ') || 'none' }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-16 text-muted">Skills</dt>
            <dd class="text-ink-2">{{ c.skills.join(', ') || 'none' }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-16 text-muted">Memory</dt>
            <dd class="text-ink-2">{{ c.memoryEnabled ? 'on' : 'off' }}</dd>
          </div>
        </dl>
      </RouterLink>
    </div>
  </QueryState>
</template>
