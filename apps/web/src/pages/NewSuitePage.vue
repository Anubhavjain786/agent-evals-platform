<script setup lang="ts">
import { SuiteSchema } from '@agent-evals/shared';
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { useCreateSuite } from '@/api/queries';
import ErrorList from '@/components/ui/ErrorList.vue';
import PageHeader from '@/components/ui/PageHeader.vue';

const TEMPLATE = `id: my-suite
name: My suite
description: What this suite measures.
tasks:
  - id: capital-of-france
    name: Capital of France
    tags: [reasoning]
    prompt: What is the capital of France? Reply with one word.
    scoring:
      scorers:
        - type: exact_match
          expected: Paris
    limits: { timeoutSec: 120, maxTurns: 3 }

  - id: write-a-file
    name: Write a file
    tags: [tools]
    prompt: Create hello.txt containing exactly "hello world".
    scoring:
      scorers:
        - { type: file_exists, path: hello.txt, required: true }
        - type: command
          run: test "$(cat hello.txt)" = "hello world"
`;

const router = useRouter();
const create = useCreateSuite();
const yaml = ref(TEMPLATE);

/** Same schema as the API, so errors show while typing. */
const issues = computed(() => {
  try {
    const result = SuiteSchema.safeParse(parseYaml(yaml.value));
    return result.success ? [] : z.prettifyError(result.error).split('\n');
  } catch (error) {
    return [`Invalid YAML: ${(error as Error).message}`];
  }
});

async function submit() {
  const suite = await create.mutateAsync(yaml.value);
  await router.push(`/suites/${suite.id}`);
}
</script>

<template>
  <PageHeader
    title="New suite"
    subtitle="Write tasks and their checks in YAML. Check types: contains, exact_match, regex, numeric, json_field, file_exists, command, tool_usage, llm_judge. Folders with starting files must already exist in evals/fixtures."
  >
    <template #eyebrow>
      <RouterLink to="/suites" class="mb-1 inline-block text-xs text-muted hover:text-ink"
        >← Task suites</RouterLink
      >
    </template>
  </PageHeader>
  <form class="space-y-4" @submit.prevent="submit">
    <textarea
      v-model="yaml"
      class="input min-h-[28rem] font-mono text-xs leading-relaxed"
      spellcheck="false"
      aria-label="Suite definition (YAML)"
    />
    <ErrorList
      v-if="issues.length"
      :error="null"
      :lines="['Definition is not valid yet:', ...issues]"
    />
    <ErrorList :error="create.error.value" />
    <button
      type="submit"
      class="btn-primary"
      :disabled="issues.length > 0 || create.isPending.value"
    >
      Create suite
    </button>
  </form>
</template>
