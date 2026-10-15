<script setup lang="ts">
import type { WorkspaceFile } from '@agent-evals/shared';
import { ref } from 'vue';
import { useRunFile } from '@/api/queries';
import CodeBlock from '@/components/ui/CodeBlock.vue';
import Icon from '@/components/ui/Icon.vue';
import { compact } from '@/lib/format';

const props = defineProps<{ runId: string; files: WorkspaceFile[] }>();
const selected = ref<string | null>(props.files.find((f) => f.created || f.modified)?.path ?? null);
const file = useRunFile(() => props.runId, selected);
</script>

<template>
  <div v-if="files.length === 0" class="text-sm text-muted">The run folder was empty.</div>
  <div v-else class="grid gap-4 lg:grid-cols-[16rem_1fr]">
    <ul class="max-h-96 space-y-0.5 overflow-auto text-sm">
      <li v-for="f in files" :key="f.path">
        <button
          type="button"
          class="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-surface-2"
          :class="{ 'bg-accent-soft': selected === f.path }"
          @click="selected = f.path"
        >
          <Icon name="file" :size="14" class="shrink-0 text-muted" />
          <span class="truncate font-mono text-xs" :title="f.path">{{ f.path }}</span>
          <span
            v-if="f.created"
            class="ml-auto shrink-0 text-[10px] font-semibold tracking-wide text-good-ink uppercase"
            >new</span
          >
          <span
            v-else-if="f.modified"
            class="ml-auto shrink-0 text-[10px] font-semibold tracking-wide text-serious uppercase"
            >edited</span
          >
        </button>
      </li>
    </ul>
    <div class="min-w-0">
      <p v-if="!selected" class="text-sm text-muted">Select a file to view it.</p>
      <p v-else-if="file.isLoading.value" class="text-sm text-muted">Loading…</p>
      <template v-else-if="file.data.value">
        <p class="mb-1.5 font-mono text-xs text-muted">
          {{ file.data.value.path }} · {{ compact(file.data.value.size) }} bytes
          <template v-if="file.data.value.truncated"> · truncated</template>
        </p>
        <p v-if="file.data.value.binary" class="text-sm text-muted">Binary file — not shown.</p>
        <CodeBlock v-else :value="file.data.value.content" max-height="28rem" />
      </template>
      <p v-else-if="file.error.value" class="text-sm text-critical">
        {{ (file.error.value as Error).message }}
      </p>
    </div>
  </div>
</template>
