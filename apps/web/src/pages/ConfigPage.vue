<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router';
import { stringify as toYaml } from 'yaml';
import { useConfig, useDeleteConfig } from '@/api/queries';
import CodeBlock from '@/components/ui/CodeBlock.vue';
import ErrorList from '@/components/ui/ErrorList.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import QueryState from '@/components/ui/QueryState.vue';

const props = defineProps<{ id: string }>();
const router = useRouter();
const config = useConfig(() => props.id);
const remove = useDeleteConfig();

async function onDelete() {
  if (!window.confirm('Delete this config? Past experiments keep their own snapshot.')) return;
  await remove.mutateAsync(props.id);
  await router.push('/configs');
}
</script>

<template>
  <QueryState :loading="config.isLoading.value" :error="config.error.value">
    <template v-if="config.data.value">
      <PageHeader :title="config.data.value.name" :subtitle="config.data.value.description">
        <template #eyebrow>
          <RouterLink to="/configs" class="mb-1 inline-block text-xs text-muted hover:text-ink"
            >← Agent configs</RouterLink
          >
        </template>
        <template #meta>
          <p class="mt-2 font-mono text-xs text-muted">
            {{ config.data.value.id }}@{{ config.data.value.version }} ·
            {{
              config.data.value.source === 'file'
                ? `evals/configs/${config.data.value.id}.yaml (read-only here)`
                : 'created in UI'
            }}
          </p>
        </template>
        <template #actions>
          <RouterLink
            :to="{ path: '/configs/new', query: { from: config.data.value.id } }"
            class="btn-secondary"
            ><Icon name="copy" :size="15" />Duplicate</RouterLink
          >
          <template v-if="config.data.value.source === 'user'">
            <RouterLink :to="`/configs/${config.data.value.id}/edit`" class="btn-secondary"
              >Edit</RouterLink
            >
            <button class="btn-danger" @click="onDelete">
              <Icon name="trash" :size="15" />Delete
            </button>
          </template>
        </template>
      </PageHeader>
      <ErrorList :error="remove.error.value" class="mb-4" />

      <div class="grid gap-6 lg:grid-cols-2">
        <section class="card space-y-4 p-5 text-sm">
          <div>
            <p class="label">Model</p>
            <p class="font-mono text-ink">
              {{ config.data.value.definition.model.provider }} /
              {{ config.data.value.definition.model.name }}
            </p>
            <p
              v-if="config.data.value.definition.model.baseUrl"
              class="font-mono text-xs text-muted"
            >
              {{ config.data.value.definition.model.baseUrl }}
            </p>
            <p v-if="config.data.value.definition.model.pricing" class="mt-1 text-xs text-muted">
              Priced at ${{ config.data.value.definition.model.pricing.inputPerMTok }} / ${{
                config.data.value.definition.model.pricing.outputPerMTok
              }}
              per million input / output tokens
            </p>
          </div>
          <div>
            <p class="label">Toolsets</p>
            <p class="text-ink">{{ config.data.value.definition.toolsets.join(', ') || 'none' }}</p>
          </div>
          <div>
            <p class="label">Skills</p>
            <p class="text-ink">
              {{ config.data.value.definition.skills.include.join(', ') || 'none' }}
              <span v-if="config.data.value.definition.skills.bundled" class="text-muted"
                >+ Hermes built-in skills</span
              >
            </p>
          </div>
          <div>
            <p class="label">Memory</p>
            <p v-if="!config.data.value.definition.memory.enabled" class="text-ink">Off</p>
            <ul v-else class="list-disc space-y-1 pl-4 text-ink-2">
              <li v-for="note in config.data.value.definition.memory.notes" :key="note">
                {{ note }}
              </li>
              <li v-for="note in config.data.value.definition.memory.userProfile" :key="note">
                <span class="text-muted">[user]</span> {{ note }}
              </li>
            </ul>
          </div>
          <div>
            <p class="label">Turn limit</p>
            <p class="text-ink">{{ config.data.value.definition.maxTurns }} turns</p>
          </div>
        </section>
        <section class="card p-5">
          <p class="label">Definition</p>
          <CodeBlock :value="toYaml(config.data.value.definition)" max-height="32rem" />
        </section>
      </div>
    </template>
  </QueryState>
</template>
