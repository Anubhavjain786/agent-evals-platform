<script setup lang="ts">
import { CreateExperimentSchema, type CreateExperimentInput } from '@agent-evals/shared';
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useConfigs, useCreateExperiment, useSuite, useSuites } from '@/api/queries';
import ErrorList from '@/components/ui/ErrorList.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SeriesDot from '@/components/ui/SeriesDot.vue';

const router = useRouter();
const suites = useSuites();
const configs = useConfigs();
const create = useCreateExperiment();

const form = reactive({
  name: '',
  description: '',
  suiteId: '',
  configIds: [] as string[],
  baselineConfigId: '',
  trials: 3,
  concurrency: 4,
  seed: '' as string | number,
  allTasks: true,
  taskIds: [] as string[],
});

const suite = useSuite(() => form.suiteId);
watch(
  () => suites.data.value,
  (list) => {
    if (!form.suiteId && list?.length) form.suiteId = list[0]!.id;
  },
  { immediate: true },
);
watch(
  () => form.suiteId,
  () => {
    form.allTasks = true;
    form.taskIds = [];
  },
);

/** Selection order matters: the first selected config is the baseline by default. */
function toggleConfig(id: string) {
  const index = form.configIds.indexOf(id);
  if (index >= 0) form.configIds.splice(index, 1);
  else form.configIds.push(id);
  if (!form.configIds.includes(form.baselineConfigId))
    form.baselineConfigId = form.configIds[0] ?? '';
}

const taskCount = computed(() =>
  form.allTasks ? (suite.data.value?.definition.tasks.length ?? 0) : form.taskIds.length,
);
const totalRuns = computed(
  () => taskCount.value * form.configIds.length * (Number(form.trials) || 0),
);

const payload = computed<CreateExperimentInput>(() => ({
  name: form.name.trim() || defaultName.value,
  description: form.description.trim() || undefined,
  suiteId: form.suiteId,
  configIds: form.configIds,
  baselineConfigId: form.baselineConfigId || undefined,
  trials: Number(form.trials),
  concurrency: Number(form.concurrency),
  seed: form.seed === '' ? undefined : Number(form.seed),
  taskIds: form.allTasks ? undefined : form.taskIds,
}));

const defaultName = computed(() => {
  const names = form.configIds.map(
    (id) => configs.data.value?.find((c) => c.id === id)?.name ?? id,
  );
  return names.length >= 2 ? names.join(' vs ') : 'Untitled experiment';
});

const issues = computed(() => {
  const result = CreateExperimentSchema.safeParse(payload.value);
  return result.success
    ? []
    : result.error.issues.map((i) => `${i.path.join('.') || 'form'}: ${i.message}`);
});
const submitted = ref(false);

async function submit() {
  submitted.value = true;
  if (issues.value.length > 0) return;
  const experiment = await create.mutateAsync(payload.value);
  await router.push(`/experiments/${experiment.id}`);
}
</script>

<template>
  <PageHeader
    title="New experiment"
    subtitle="Pick a task suite and the configurations to compare. Every task runs under every config, several times; runs are interleaved in random order so provider hiccups hit all configs alike."
  >
    <template #eyebrow>
      <RouterLink to="/experiments" class="mb-1 inline-block text-xs text-muted hover:text-ink"
        >← Experiments</RouterLink
      >
    </template>
  </PageHeader>

  <form class="grid gap-6 lg:grid-cols-[1fr_20rem]" @submit.prevent="submit">
    <div class="space-y-6">
      <section class="card space-y-4 p-5">
        <div>
          <label class="label" for="name">Name</label>
          <input
            id="name"
            v-model="form.name"
            class="input"
            :placeholder="defaultName"
            maxlength="200"
          />
        </div>
        <div>
          <label class="label" for="description"
            >Hypothesis / notes <span class="normal-case">(optional)</span></label
          >
          <textarea
            id="description"
            v-model="form.description"
            rows="2"
            class="input"
            placeholder="e.g. Adding the ACME skills improves invoice validation without regressing other tasks."
          />
        </div>
      </section>

      <section class="card p-5">
        <h2 class="mb-3 text-sm font-semibold text-ink">Task suite</h2>
        <div class="grid gap-2 sm:grid-cols-2">
          <label
            v-for="s in suites.data.value"
            :key="s.id"
            class="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
            :class="
              form.suiteId === s.id
                ? 'border-accent bg-accent-soft'
                : 'border-line hover:bg-surface-2'
            "
          >
            <input
              v-model="form.suiteId"
              type="radio"
              name="suite"
              :value="s.id"
              class="mt-1 accent-[var(--app-accent)]"
            />
            <span>
              <span class="block font-medium text-ink">{{ s.name }}</span>
              <span class="block text-xs text-muted"
                >{{ s.taskCount }} tasks · {{ s.tags.join(', ') }}</span
              >
            </span>
          </label>
        </div>
        <div v-if="suite.data.value" class="mt-4">
          <label class="flex items-center gap-2 text-sm text-ink-2">
            <input v-model="form.allTasks" type="checkbox" class="accent-[var(--app-accent)]" />
            Run all {{ suite.data.value.definition.tasks.length }} tasks
          </label>
          <div v-if="!form.allTasks" class="mt-3 grid gap-1.5 sm:grid-cols-2">
            <label
              v-for="t in suite.data.value.definition.tasks"
              :key="t.id"
              class="flex items-center gap-2 text-sm text-ink"
            >
              <input
                v-model="form.taskIds"
                type="checkbox"
                :value="t.id"
                class="accent-[var(--app-accent)]"
              />
              <span class="truncate">{{ t.name }}</span>
              <span class="text-xs text-muted">{{ t.tags.join(', ') }}</span>
            </label>
          </div>
        </div>
      </section>

      <section class="card p-5">
        <div class="mb-3 flex items-baseline justify-between">
          <h2 class="text-sm font-semibold text-ink">Configurations to compare</h2>
          <RouterLink to="/configs/new" class="text-xs text-accent hover:underline"
            >New config</RouterLink
          >
        </div>
        <div class="grid gap-2 sm:grid-cols-2">
          <button
            v-for="c in configs.data.value"
            :key="c.id"
            type="button"
            class="flex items-start gap-3 rounded-lg border p-3 text-left"
            :class="
              form.configIds.includes(c.id)
                ? 'border-accent bg-accent-soft'
                : 'border-line hover:bg-surface-2'
            "
            :aria-pressed="form.configIds.includes(c.id)"
            @click="toggleConfig(c.id)"
          >
            <span
              class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-line text-xs font-semibold"
            >
              <SeriesDot
                v-if="form.configIds.includes(c.id)"
                :index="form.configIds.indexOf(c.id)"
              />
            </span>
            <span class="min-w-0">
              <span class="block truncate font-medium text-ink">{{ c.name }}</span>
              <span class="block truncate font-mono text-xs text-muted"
                >{{ c.model.provider }}/{{ c.model.name }}</span
              >
              <span class="mt-1 block text-xs text-ink-2">
                {{ c.toolsets.join(', ') || 'no tools'
                }}<template v-if="c.skills.length"> · skills: {{ c.skills.join(', ') }}</template
                ><template v-if="c.memoryEnabled"> · memory</template>
              </span>
            </span>
          </button>
        </div>
        <div v-if="form.configIds.length >= 2" class="mt-4 max-w-sm">
          <label class="label" for="baseline">Baseline</label>
          <select id="baseline" v-model="form.baselineConfigId" class="input">
            <option v-for="id in form.configIds" :key="id" :value="id">
              {{ configs.data.value?.find((c) => c.id === id)?.name ?? id }}
            </option>
          </select>
          <p class="mt-1 text-xs text-muted">
            Every other config is compared against the baseline.
          </p>
        </div>
      </section>
    </div>

    <aside class="space-y-4">
      <section class="card space-y-4 p-5">
        <div>
          <label class="label" for="trials">Trials per task</label>
          <input
            id="trials"
            v-model.number="form.trials"
            type="number"
            min="1"
            max="20"
            class="input"
          />
          <p class="mt-1 text-xs text-muted">
            Agents are stochastic. 3+ trials separate luck from skill.
          </p>
        </div>
        <div>
          <label class="label" for="concurrency">Concurrency</label>
          <input
            id="concurrency"
            v-model.number="form.concurrency"
            type="number"
            min="1"
            max="32"
            class="input"
          />
          <p class="mt-1 text-xs text-muted">
            Runs of this experiment in flight at once (also capped server-side).
          </p>
        </div>
        <div>
          <label class="label" for="seed">Seed <span class="normal-case">(optional)</span></label>
          <input
            id="seed"
            v-model="form.seed"
            type="number"
            min="0"
            class="input"
            placeholder="random"
          />
          <p class="mt-1 text-xs text-muted">Fixes run order and the statistics' resampling.</p>
        </div>
      </section>
      <section class="card p-5">
        <p class="num text-3xl font-semibold text-ink">{{ totalRuns }}</p>
        <p class="text-sm text-ink-2">
          runs = {{ taskCount }} tasks × {{ form.configIds.length }} configs ×
          {{ form.trials || 0 }} trials
        </p>
        <p v-if="form.configIds.length === 1" class="mt-3 text-xs text-muted">
          With a single config you get its pass rate and intervals, but no comparison.
        </p>
        <ErrorList v-if="submitted && issues.length" :error="null" :lines="issues" class="mt-4" />
        <ErrorList v-else :error="create.error.value" class="mt-4" />
        <button
          type="submit"
          class="btn-primary mt-4 w-full"
          :disabled="create.isPending.value || totalRuns === 0"
        >
          {{ create.isPending.value ? 'Starting…' : 'Start experiment' }}
        </button>
      </section>
    </aside>
  </form>
</template>
