<script setup lang="ts">
/**
 * The agent's trajectory: assistant messages, tool calls paired with their
 * results, and the terminal result. Tool results are matched to calls by id
 * so each step reads as "what the agent tried → what happened".
 */
import type { TrajectoryEvent } from '@agent-evals/shared';
import { computed } from 'vue';
import CodeBlock from '@/components/ui/CodeBlock.vue';
import Icon from '@/components/ui/Icon.vue';
import { duration } from '@/lib/format';

const props = defineProps<{ events: TrajectoryEvent[]; live?: boolean }>();

type ToolCall = Extract<TrajectoryEvent, { type: 'tool_call' }>;
type ToolResult = Extract<TrajectoryEvent, { type: 'tool_result' }>;
type Step =
  | { kind: 'text'; seq: number; ts: number; text: string }
  | { kind: 'tool'; seq: number; ts: number; call: ToolCall; result: ToolResult | null }
  | { kind: 'result'; seq: number; ts: number; event: Extract<TrajectoryEvent, { type: 'result' }> }
  | { kind: 'init'; seq: number; ts: number; model: string };

const steps = computed<Step[]>(() => {
  const results = new Map<string, ToolResult>();
  for (const e of props.events) if (e.type === 'tool_result') results.set(e.toolCallId, e);
  const out: Step[] = [];
  for (const e of props.events) {
    if (e.type === 'assistant_text') out.push({ kind: 'text', seq: e.seq, ts: e.ts, text: e.text });
    else if (e.type === 'tool_call')
      out.push({
        kind: 'tool',
        seq: e.seq,
        ts: e.ts,
        call: e,
        result: results.get(e.toolCallId) ?? null,
      });
    else if (e.type === 'result') out.push({ kind: 'result', seq: e.seq, ts: e.ts, event: e });
    else if (e.type === 'init') out.push({ kind: 'init', seq: e.seq, ts: e.ts, model: e.model });
  }
  return out;
});

const start = computed(() => props.events[0]?.ts ?? 0);
const offset = (ts: number) => `+${((ts - start.value) / 1000).toFixed(1)}s`;

/** Short, readable summary of a tool call's arguments. */
function summary(call: ToolCall): string {
  const input = call.input as Record<string, unknown> | null;
  if (!input || typeof input !== 'object') return '';
  const preferred = ['command', 'path', 'query', 'pattern', 'name']
    .map((key) => input[key])
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (!preferred) return '';
  return preferred.length > 140 ? `${preferred.slice(0, 140)}…` : preferred;
}

function pretty(output: string): string {
  try {
    return JSON.stringify(JSON.parse(output), null, 2);
  } catch {
    return output;
  }
}
</script>

<template>
  <ol class="relative space-y-3 border-l border-line pl-5">
    <li v-for="step in steps" :key="step.seq" class="relative">
      <span
        class="absolute top-1 -left-[27px] flex size-3.5 items-center justify-center rounded-full bg-surface ring-1 ring-line"
      >
        <span
          class="size-1.5 rounded-full"
          :class="step.kind === 'tool' ? 'bg-accent' : 'bg-ink-2'"
        />
      </span>
      <div class="mb-1 flex items-center gap-2 text-xs text-muted">
        <span class="num">{{ offset(step.ts) }}</span>
        <template v-if="step.kind === 'text'"
          ><Icon name="message" :size="13" /> Assistant</template
        >
        <template v-else-if="step.kind === 'tool'">
          <Icon name="wrench" :size="13" />
          <span class="font-mono font-medium text-ink">{{ step.call.name }}</span>
          <span v-if="step.result?.durationMs != null"
            >· {{ duration(step.result.durationMs) }}</span
          >
          <span
            v-if="step.result?.isError"
            class="inline-flex items-center gap-0.5 font-medium text-critical"
          >
            <Icon name="x" :size="12" />error
          </span>
          <span v-else-if="!step.result" class="inline-flex items-center gap-1"
            ><Icon name="spinner" :size="12" />running</span
          >
        </template>
        <template v-else-if="step.kind === 'result'"
          ><Icon name="flag" :size="13" /> Finished (exit {{ step.event.exitCode }})</template
        >
        <template v-else>Session started</template>
      </div>

      <p v-if="step.kind === 'text'" class="text-sm whitespace-pre-wrap text-ink">
        {{ step.text.trim() }}
      </p>

      <div v-else-if="step.kind === 'tool'" class="rounded-lg border border-line">
        <details>
          <summary
            class="cursor-pointer px-3 py-2 font-mono text-xs break-all text-ink-2 hover:text-ink"
          >
            {{ summary(step.call) || 'arguments' }}
          </summary>
          <div class="space-y-2 border-t border-line p-3">
            <div>
              <p class="label">Input</p>
              <CodeBlock :value="step.call.input" max-height="14rem" />
            </div>
            <div v-if="step.result">
              <p class="label">Output</p>
              <CodeBlock :value="pretty(step.result.output)" max-height="18rem" />
            </div>
          </div>
        </details>
      </div>

      <div v-else-if="step.kind === 'result' && step.event.error" class="text-sm text-critical">
        {{ step.event.error }}
      </div>
    </li>
    <li v-if="live" class="flex items-center gap-2 text-xs text-muted">
      <Icon name="spinner" :size="13" /> Waiting for the agent…
    </li>
  </ol>
</template>
