<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { stringify as toYaml } from 'yaml';
import { useDeleteSuite, useSuite } from '@/api/queries';
import CodeBlock from '@/components/ui/CodeBlock.vue';
import ErrorList from '@/components/ui/ErrorList.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import QueryState from '@/components/ui/QueryState.vue';

const props = defineProps<{ id: string }>();
const router = useRouter();
const suite = useSuite(() => props.id);
const remove = useDeleteSuite();
const open = ref<string | null>(null);

async function onDelete() {
  if (!window.confirm('Delete this suite? Past experiments keep their own snapshot.')) return;
  await remove.mutateAsync(props.id);
  await router.push('/suites');
}
</script>

<template>
  <QueryState :loading="suite.isLoading.value" :error="suite.error.value">
    <template v-if="suite.data.value">
      <PageHeader :title="suite.data.value.name" :subtitle="suite.data.value.description">
        <template #eyebrow>
          <RouterLink to="/suites" class="mb-1 inline-block text-xs text-muted hover:text-ink"
            >← Task suites</RouterLink
          >
        </template>
        <template #meta>
          <p class="mt-2 font-mono text-xs text-muted">
            {{ suite.data.value.id }}@{{ suite.data.value.version }} ·
            {{
              suite.data.value.source === 'file'
                ? `evals/suites/${suite.data.value.id}.yaml`
                : 'created in UI'
            }}
          </p>
        </template>
        <template #actions>
          <RouterLink :to="{ path: '/experiments/new' }" class="btn-primary"
            ><Icon name="flask" :size="15" />Run experiment</RouterLink
          >
          <button v-if="suite.data.value.source === 'user'" class="btn-danger" @click="onDelete">
            <Icon name="trash" :size="15" />Delete
          </button>
        </template>
      </PageHeader>
      <ErrorList :error="remove.error.value" class="mb-4" />

      <div class="card divide-y divide-line">
        <article v-for="task in suite.data.value.definition.tasks" :key="task.id">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-2/60"
            :aria-expanded="open === task.id"
            @click="open = open === task.id ? null : task.id"
          >
            <Icon
              name="chevron"
              :size="14"
              class="shrink-0 text-muted transition-transform"
              :class="{ 'rotate-90': open === task.id }"
            />
            <span class="min-w-0 flex-1">
              <span class="block font-medium text-ink">{{ task.name }}</span>
              <span class="block font-mono text-xs text-muted">{{ task.id }}</span>
            </span>
            <span class="hidden flex-wrap justify-end gap-1 sm:flex">
              <span
                v-for="tag in task.tags"
                :key="tag"
                class="rounded bg-surface-2 px-1.5 text-[11px] text-muted"
                >{{ tag }}</span
              >
            </span>
            <span class="w-24 text-right text-xs text-muted"
              >{{ task.scoring.scorers.length }} check{{
                task.scoring.scorers.length === 1 ? '' : 's'
              }}</span
            >
          </button>
          <div v-if="open === task.id" class="grid gap-4 px-5 pb-5 lg:grid-cols-2">
            <div>
              <p class="label">Prompt</p>
              <CodeBlock :value="task.prompt" max-height="16rem" />
              <p class="mt-2 text-xs text-muted">
                <template v-if="task.fixtures"
                  >Workspace: <span class="font-mono">evals/fixtures/{{ task.fixtures }}</span> ·
                </template>
                Timeout {{ task.limits.timeoutSec }}s<template v-if="task.limits.maxTurns">
                  · max {{ task.limits.maxTurns }} turns</template
                >
                · passes when
                {{
                  task.scoring.passThreshold === undefined
                    ? 'every check passes'
                    : `weighted score ≥ ${task.scoring.passThreshold}`
                }}
              </p>
            </div>
            <div>
              <p class="label">Checks</p>
              <CodeBlock :value="toYaml(task.scoring.scorers)" max-height="16rem" />
            </div>
          </div>
        </article>
      </div>
    </template>
  </QueryState>
</template>
