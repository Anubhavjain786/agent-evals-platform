<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useSuites } from '@/api/queries';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import QueryState from '@/components/ui/QueryState.vue';
import { relativeTime } from '@/lib/format';

const suites = useSuites();
</script>

<template>
  <PageHeader
    title="Task suites"
    subtitle="A suite is a set of tasks. Each task has a prompt, optional starting files, and the checks that decide pass or fail. Suites in evals/suites are loaded from files on startup; you can also add one here."
  >
    <template #actions>
      <RouterLink to="/suites/new" class="btn-primary"
        ><Icon name="plus" :size="15" />New suite</RouterLink
      >
    </template>
  </PageHeader>
  <QueryState
    :loading="suites.isLoading.value"
    :error="suites.error.value"
    :empty="suites.data.value?.length === 0"
  >
    <div class="grid gap-4 md:grid-cols-2">
      <RouterLink
        v-for="s in suites.data.value"
        :key="s.id"
        :to="`/suites/${s.id}`"
        class="card block p-5 hover:border-accent"
      >
        <div class="flex items-start justify-between gap-3">
          <h2 class="font-semibold text-ink">{{ s.name }}</h2>
          <span class="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{{
            s.source === 'file' ? 'file' : 'created in UI'
          }}</span>
        </div>
        <p class="mt-1 line-clamp-3 text-sm text-ink-2">{{ s.description }}</p>
        <div class="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span class="font-medium text-ink-2">{{ s.taskCount }} tasks</span>
          <span v-for="tag in s.tags" :key="tag" class="rounded bg-surface-2 px-1.5">{{
            tag
          }}</span>
          <span class="ml-auto font-mono">v{{ s.version }} · {{ relativeTime(s.updatedAt) }}</span>
        </div>
      </RouterLink>
    </div>
  </QueryState>
</template>
