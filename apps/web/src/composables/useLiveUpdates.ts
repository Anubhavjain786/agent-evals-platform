import type { LiveEvent, RunDetail } from '@agent-evals/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { onBeforeUnmount, type MaybeRefOrGetter, toValue, watch } from 'vue';
import { keys } from '@/api/queries';

const LIVE_EVENT_TYPES = ['experiment.updated', 'run.updated', 'run.event'] as const;
/** Coalesce bursts of run updates into one refetch of the aggregate views. */
const REFRESH_DEBOUNCE_MS = 750;

function subscribe(url: string, onEvent: (event: LiveEvent) => void): () => void {
  const source = new EventSource(url);
  const handler = (message: MessageEvent<string>) => onEvent(JSON.parse(message.data) as LiveEvent);
  for (const type of LIVE_EVENT_TYPES) source.addEventListener(type, handler);
  return () => source.close();
}

/** Keeps an experiment's queries fresh from its Server-Sent Events stream while it is active. */
export function useLiveExperiment(id: MaybeRefOrGetter<string>, active: MaybeRefOrGetter<boolean>) {
  const client = useQueryClient();
  let close: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const refresh = (experimentId: string) => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void client.invalidateQueries({ queryKey: keys.experiment(experimentId) });
      void client.invalidateQueries({ queryKey: keys.experiments });
    }, REFRESH_DEBOUNCE_MS);
  };

  watch(
    () => [toValue(id), toValue(active)] as const,
    ([experimentId, isActive]) => {
      close?.();
      close = null;
      if (!isActive) return;
      close = subscribe(`/api/experiments/${experimentId}/stream`, (event) => {
        if (event.type !== 'run.event') refresh(experimentId);
      });
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    close?.();
    if (timer) clearTimeout(timer);
  });
}

/** Streams a running run's trajectory into the cached run detail. */
export function useLiveRun(id: MaybeRefOrGetter<string>, active: MaybeRefOrGetter<boolean>) {
  const client = useQueryClient();
  let close: (() => void) | null = null;

  watch(
    () => [toValue(id), toValue(active)] as const,
    ([runId, isActive]) => {
      close?.();
      close = null;
      if (!isActive) return;
      close = subscribe(`/api/runs/${runId}/stream`, (event) => {
        if (event.type === 'run.event') {
          client.setQueryData<RunDetail>(keys.run(runId), (run) =>
            run && !run.events.some((e) => e.seq === event.event.seq)
              ? { ...run, events: [...run.events, event.event] }
              : run,
          );
        } else if (event.type === 'run.updated') {
          void client.invalidateQueries({ queryKey: keys.run(runId) });
        }
      });
    },
    { immediate: true },
  );

  onBeforeUnmount(() => close?.());
}
