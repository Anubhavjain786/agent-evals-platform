<script setup lang="ts">
import type { ScoreResult } from '@agent-evals/shared';
import CodeBlock from '@/components/ui/CodeBlock.vue';
import Icon from '@/components/ui/Icon.vue';
import { pct } from '@/lib/format';

defineProps<{ scores: ScoreResult[] }>();
</script>

<template>
  <ul class="divide-y divide-line">
    <li v-for="score in scores" :key="score.scorerId" class="py-3 first:pt-0 last:pb-0">
      <div class="flex items-start gap-2">
        <span
          class="mt-0.5 shrink-0"
          :class="
            score.status === 'error'
              ? 'text-serious'
              : score.passed
                ? 'text-good-ink'
                : 'text-critical'
          "
          :aria-label="
            score.status === 'error' ? 'Scorer error' : score.passed ? 'Passed' : 'Failed'
          "
        >
          <Icon :name="score.status === 'error' ? 'alert' : score.passed ? 'check' : 'x'" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span class="font-mono text-sm font-medium text-ink">{{ score.scorerId }}</span>
            <span class="rounded bg-surface-2 px-1.5 text-[11px] text-muted">{{ score.type }}</span>
            <span
              v-if="score.required"
              class="text-[11px] font-semibold tracking-wide text-ink-2 uppercase"
              >required</span
            >
            <span class="num ml-auto text-xs text-muted"
              >score {{ pct(score.score, 0) }} · weight {{ score.weight }}</span
            >
          </div>
          <p v-if="score.description" class="mt-0.5 text-xs text-muted">{{ score.description }}</p>
          <p class="mt-1 text-sm text-ink-2">{{ score.reason }}</p>
          <details v-if="score.evidence" class="mt-1.5">
            <summary class="cursor-pointer text-xs text-muted hover:text-ink">Evidence</summary>
            <CodeBlock :value="score.evidence" class="mt-1.5" max-height="16rem" />
          </details>
        </div>
      </div>
    </li>
  </ul>
</template>
