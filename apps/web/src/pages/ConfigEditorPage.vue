<script setup lang="ts">
import { type AgentConfigDefinition, AgentConfigSchema } from '@agent-evals/shared';
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useCatalog, useConfig, useSaveConfig } from '@/api/queries';
import ErrorList from '@/components/ui/ErrorList.vue';
import PageHeader from '@/components/ui/PageHeader.vue';

/**
 * Create, duplicate (`from`) or edit (`editId`) an agent config. The form
 * validates with the same schema the API uses.
 */
const props = defineProps<{ editId?: string | null; from?: string | null }>();
const router = useRouter();
const catalog = useCatalog();
const source = useConfig(() => props.from ?? null);
const save = useSaveConfig();

const REASONING = ['', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const;

const form = reactive({
  id: '',
  name: '',
  description: '',
  provider: 'custom',
  modelName: '',
  baseUrl: '${OLLAMA_BASE_URL:-http://localhost:11434/v1}',
  apiKeyEnv: '',
  contextLength: '' as number | '',
  reasoningEffort: '' as (typeof REASONING)[number],
  inputPrice: '' as number | '',
  outputPrice: '' as number | '',
  toolsets: ['file', 'terminal'] as string[],
  skills: [] as string[],
  preload: [] as string[],
  memoryEnabled: false,
  memoryNotes: '',
  userProfile: '',
  persona: '',
  maxTurns: 20,
});

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

function load(definition: AgentConfigDefinition, duplicate: boolean) {
  Object.assign(form, {
    id: duplicate ? `${definition.id}-copy` : definition.id,
    name: duplicate ? `${definition.name} (copy)` : definition.name,
    description: definition.description ?? '',
    provider: definition.model.provider,
    modelName: definition.model.name,
    baseUrl: definition.model.baseUrl ?? '',
    apiKeyEnv: definition.model.apiKeyEnv ?? '',
    contextLength: definition.model.contextLength ?? '',
    reasoningEffort: definition.model.reasoningEffort ?? '',
    inputPrice: definition.model.pricing?.inputPerMTok ?? '',
    outputPrice: definition.model.pricing?.outputPerMTok ?? '',
    toolsets: [...definition.toolsets],
    skills: [...definition.skills.include],
    preload: [...definition.skills.preload],
    memoryEnabled: definition.memory.enabled,
    memoryNotes: definition.memory.notes.join('\n'),
    userProfile: definition.memory.userProfile.join('\n'),
    persona: definition.persona ?? '',
    maxTurns: definition.maxTurns,
  });
}

watch(
  () => source.data.value,
  (detail) => {
    if (detail) load(detail.definition, !props.editId);
  },
  { immediate: true },
);

const draft = computed(() => ({
  id: form.id.trim(),
  name: form.name.trim(),
  description: form.description.trim() || undefined,
  model: {
    provider: form.provider.trim(),
    name: form.modelName.trim(),
    baseUrl: form.baseUrl.trim() || undefined,
    apiKeyEnv: form.apiKeyEnv.trim() || undefined,
    contextLength: form.contextLength === '' ? undefined : Number(form.contextLength),
    reasoningEffort: form.reasoningEffort || undefined,
    pricing:
      form.inputPrice === '' || form.outputPrice === ''
        ? undefined
        : { inputPerMTok: Number(form.inputPrice), outputPerMTok: Number(form.outputPrice) },
  },
  toolsets: form.toolsets,
  skills: {
    bundled: false,
    include: form.skills,
    preload: form.preload.filter((p) => form.skills.includes(p)),
  },
  memory: {
    enabled: form.memoryEnabled,
    notes: lines(form.memoryNotes),
    userProfile: lines(form.userProfile),
  },
  persona: form.persona.trim() || undefined,
  maxTurns: Number(form.maxTurns),
}));

const issues = computed(() => {
  const result = AgentConfigSchema.safeParse(draft.value);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
});
const submitted = ref(false);

async function submit() {
  submitted.value = true;
  if (issues.value.length) return;
  const saved = await save.mutateAsync({ id: props.editId ?? null, definition: draft.value });
  await router.push(`/configs/${saved.id}`);
}
</script>

<template>
  <PageHeader
    :title="editId ? 'Edit config' : from ? 'Duplicate config' : 'New config'"
    subtitle="Change one variable at a time against a baseline config so an experiment can attribute any difference to that change."
  >
    <template #eyebrow>
      <RouterLink to="/configs" class="mb-1 inline-block text-xs text-muted hover:text-ink"
        >← Agent configs</RouterLink
      >
    </template>
  </PageHeader>

  <form class="grid gap-6 lg:grid-cols-2" @submit.prevent="submit">
    <section class="card space-y-4 p-5">
      <h2 class="text-sm font-semibold text-ink">Identity</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="id">Id</label>
          <input
            id="id"
            v-model="form.id"
            class="input font-mono"
            :disabled="!!editId"
            placeholder="gpt-oss-120b-skills"
          />
        </div>
        <div>
          <label class="label" for="name">Name</label>
          <input id="name" v-model="form.name" class="input" placeholder="gpt-oss 120B + skills" />
        </div>
      </div>
      <div>
        <label class="label" for="description">Description</label>
        <textarea id="description" v-model="form.description" rows="2" class="input" />
      </div>

      <h2 class="pt-2 text-sm font-semibold text-ink">Model</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="provider">Hermes provider</label>
          <input id="provider" v-model="form.provider" class="input font-mono" list="providers" />
          <datalist id="providers">
            <option value="custom" />
            <option value="openrouter" />
            <option value="anthropic" />
            <option value="openai-api" />
            <option value="nous" />
          </datalist>
        </div>
        <div>
          <label class="label" for="model">Model</label>
          <input
            id="model"
            v-model="form.modelName"
            class="input font-mono"
            placeholder="gpt-oss:120b-cloud"
          />
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="baseUrl"
            >Base URL
            <span class="normal-case">(custom providers; ${VAR:-default} allowed)</span></label
          >
          <input id="baseUrl" v-model="form.baseUrl" class="input font-mono text-xs" />
        </div>
        <div>
          <label class="label" for="apiKeyEnv">API key env var</label>
          <input
            id="apiKeyEnv"
            v-model="form.apiKeyEnv"
            class="input font-mono"
            placeholder="OPENROUTER_API_KEY"
          />
        </div>
        <div>
          <label class="label" for="reasoning">Reasoning effort</label>
          <select id="reasoning" v-model="form.reasoningEffort" class="input">
            <option v-for="r in REASONING" :key="r" :value="r">{{ r || 'model default' }}</option>
          </select>
        </div>
        <div>
          <label class="label" for="inputPrice">$ / M input tokens</label>
          <input
            id="inputPrice"
            v-model.number="form.inputPrice"
            type="number"
            step="0.001"
            min="0"
            class="input"
          />
        </div>
        <div>
          <label class="label" for="outputPrice">$ / M output tokens</label>
          <input
            id="outputPrice"
            v-model.number="form.outputPrice"
            type="number"
            step="0.001"
            min="0"
            class="input"
          />
        </div>
        <div>
          <label class="label" for="context">Context length</label>
          <input
            id="context"
            v-model.number="form.contextLength"
            type="number"
            min="8000"
            class="input"
            placeholder="auto"
          />
        </div>
        <div>
          <label class="label" for="maxTurns">Max turns</label>
          <input
            id="maxTurns"
            v-model.number="form.maxTurns"
            type="number"
            min="1"
            max="200"
            class="input"
          />
        </div>
      </div>
    </section>

    <div class="space-y-6">
      <section class="card space-y-3 p-5">
        <h2 class="text-sm font-semibold text-ink">Toolsets</h2>
        <div class="grid gap-2 sm:grid-cols-2">
          <label
            v-for="t in catalog.data.value?.toolsets"
            :key="t.id"
            class="flex items-start gap-2 text-sm"
          >
            <input
              v-model="form.toolsets"
              type="checkbox"
              :value="t.id"
              class="mt-1 accent-[var(--app-accent)]"
            />
            <span>
              <span class="font-mono text-ink">{{ t.id }}</span>
              <span class="block text-xs text-muted">{{ t.description }}</span>
            </span>
          </label>
        </div>
      </section>

      <section class="card space-y-3 p-5">
        <h2 class="text-sm font-semibold text-ink">Skills</h2>
        <p v-if="!catalog.data.value?.skills.length" class="text-sm text-muted">
          No skills in evals/skills.
        </p>
        <div
          v-for="s in catalog.data.value?.skills"
          :key="s.id"
          class="flex items-start gap-2 text-sm"
        >
          <input
            :id="`skill-${s.id}`"
            v-model="form.skills"
            type="checkbox"
            :value="s.id"
            class="mt-1 accent-[var(--app-accent)]"
          />
          <label :for="`skill-${s.id}`" class="flex-1">
            <span class="font-mono text-ink">{{ s.id }}</span>
            <span class="block text-xs text-muted">{{ s.description }}</span>
          </label>
          <label
            v-if="form.skills.includes(s.id)"
            class="flex items-center gap-1 text-xs text-ink-2"
          >
            <input
              v-model="form.preload"
              type="checkbox"
              :value="s.id"
              class="accent-[var(--app-accent)]"
            />preload
          </label>
        </div>
        <p class="text-xs text-muted">
          Add the <span class="font-mono">skills</span> toolset so the agent can discover and load
          skills on demand; "preload" puts a skill in the system prompt.
        </p>
      </section>

      <section class="card space-y-3 p-5">
        <label class="flex items-center gap-2 text-sm font-semibold text-ink">
          <input
            v-model="form.memoryEnabled"
            type="checkbox"
            class="accent-[var(--app-accent)]"
          />Persistent memory
        </label>
        <template v-if="form.memoryEnabled">
          <div>
            <label class="label" for="notes">Seeded memory notes (one per line)</label>
            <textarea
              id="notes"
              v-model="form.memoryNotes"
              rows="4"
              class="input text-xs"
              placeholder="Facts the agent learned in earlier sessions"
            />
          </div>
          <div>
            <label class="label" for="profile">User profile (one per line)</label>
            <textarea id="profile" v-model="form.userProfile" rows="2" class="input text-xs" />
          </div>
        </template>
        <div>
          <label class="label" for="persona">Persona (SOUL.md, optional)</label>
          <textarea id="persona" v-model="form.persona" rows="2" class="input text-xs" />
        </div>
      </section>

      <ErrorList v-if="submitted && issues.length" :error="null" :lines="issues" />
      <ErrorList :error="save.error.value" />
      <button type="submit" class="btn-primary w-full" :disabled="save.isPending.value">
        {{ editId ? 'Save changes' : 'Create config' }}
      </button>
    </div>
  </form>
</template>
