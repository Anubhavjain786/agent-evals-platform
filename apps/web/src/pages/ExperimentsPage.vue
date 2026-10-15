<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useExperiments } from '@/api/queries';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import ProgressBar from '@/components/ui/ProgressBar.vue';
import QueryState from '@/components/ui/QueryState.vue';
import SeriesDot from '@/components/ui/SeriesDot.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { relativeTime, usd } from '@/lib/format';

const experiments = useExperiments();
</script>

<template>
  <PageHeader
    title="Experiments"
    subtitle="An experiment runs every task in a suite with two or more agent configs, several times each. It tells you which config is better, and how sure you can be."
  >
    <template #actions>
      <RouterLink to="/experiments/new" class="btn-primary"
        ><Icon name="plus" :size="15" />New experiment</RouterLink
      >
    </template>
  </PageHeader>

  <QueryState
    :loading="experiments.isLoading.value"
    :error="experiments.error.value"
    :empty="experiments.data.value?.length === 0"
  >
    <template #empty>
      <p class="mb-3">No experiments yet.</p>
      <RouterLink to="/experiments/new" class="btn-primary">Run your first experiment</RouterLink>
    </template>
    <div class="card overflow-hidden">
      <table class="table">
        <thead>
          <tr>
            <th>Experiment</th>
            <th>Configs</th>
            <th class="w-56">Progress</th>
            <th>Status</th>
            <th class="text-right">Cost</th>
            <th class="text-right">Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in experiments.data.value" :key="e.id" class="hover:bg-surface-2/60">
            <td>
              <RouterLink
                :to="`/experiments/${e.id}`"
                class="font-medium text-ink hover:text-accent"
                >{{ e.name }}</RouterLink
              >
              <p class="text-xs text-muted">
                {{ e.suite.name }} · {{ e.taskCount }} tasks × {{ e.trials }} tries
              </p>
            </td>
            <td>
              <div class="flex flex-col gap-0.5 text-sm">
                <SeriesDot
                  v-for="(c, index) in e.configs"
                  :key="c.id"
                  :index="index"
                  :label="c.name"
                  :baseline="c.id === e.baselineConfigId"
                />
              </div>
            </td>
            <td><ProgressBar :progress="e.progress" /></td>
            <td><StatusBadge :status="e.status" /></td>
            <td class="num text-right">{{ usd(e.totalCostUsd) }}</td>
            <td class="text-right text-xs whitespace-nowrap text-muted">
              {{ relativeTime(e.createdAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </QueryState>
</template>
