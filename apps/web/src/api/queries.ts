import type { CreateExperimentInput, RunListQuery } from '@agent-evals/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { api } from './client';

/** Query keys in one place so invalidation stays consistent. */
export const keys = {
  catalog: ['catalog'] as const,
  suites: ['suites'] as const,
  suite: (id: string) => ['suites', id] as const,
  configs: ['configs'] as const,
  config: (id: string) => ['configs', id] as const,
  experiments: ['experiments'] as const,
  experiment: (id: string) => ['experiments', id] as const,
  report: (id: string) => ['experiments', id, 'report'] as const,
  runs: (id: string) => ['experiments', id, 'runs'] as const,
  run: (id: string) => ['runs', id] as const,
  runFile: (id: string, path: string) => ['runs', id, 'files', path] as const,
};

export const useCatalog = () =>
  useQuery({ queryKey: keys.catalog, queryFn: api.catalog, staleTime: 60_000 });

export const useSuites = () => useQuery({ queryKey: keys.suites, queryFn: api.suites });

export const useSuite = (id: MaybeRefOrGetter<string>) =>
  useQuery({
    queryKey: computed(() => keys.suite(toValue(id))),
    queryFn: () => api.suite(toValue(id)),
  });

export const useConfigs = () => useQuery({ queryKey: keys.configs, queryFn: api.configs });

export const useConfig = (id: MaybeRefOrGetter<string | null>) =>
  useQuery({
    queryKey: computed(() => keys.config(toValue(id) ?? '')),
    queryFn: () => api.config(toValue(id)!),
    enabled: computed(() => !!toValue(id)),
  });

const isActive = (status: string) => status === 'queued' || status === 'running';

/** The list polls gently while something runs; detail pages stream live updates instead. */
export const useExperiments = () =>
  useQuery({
    queryKey: keys.experiments,
    queryFn: api.experiments,
    refetchInterval: (query) => (query.state.data?.some((e) => isActive(e.status)) ? 4000 : false),
  });

export const useExperiment = (id: MaybeRefOrGetter<string>) =>
  useQuery({
    queryKey: computed(() => keys.experiment(toValue(id))),
    queryFn: () => api.experiment(toValue(id)),
  });

export const useReport = (id: MaybeRefOrGetter<string>) =>
  useQuery({
    queryKey: computed(() => keys.report(toValue(id))),
    queryFn: () => api.report(toValue(id)),
    placeholderData: (previous) => previous,
  });

export const useRuns = (id: MaybeRefOrGetter<string>, filters: MaybeRefOrGetter<RunListQuery>) =>
  useQuery({
    queryKey: computed(() => [...keys.runs(toValue(id)), toValue(filters)]),
    queryFn: () => api.runs(toValue(id), toValue(filters)),
    placeholderData: (previous) => previous,
  });

export const useRun = (id: MaybeRefOrGetter<string>) =>
  useQuery({
    queryKey: computed(() => keys.run(toValue(id))),
    queryFn: () => api.run(toValue(id)),
  });

export const useRunFile = (id: MaybeRefOrGetter<string>, path: MaybeRefOrGetter<string | null>) =>
  useQuery({
    queryKey: computed(() => keys.runFile(toValue(id), toValue(path) ?? '')),
    queryFn: () => api.runFile(toValue(id), toValue(path)!),
    enabled: computed(() => !!toValue(path)),
  });

export function useCreateExperiment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExperimentInput) => api.createExperiment(input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.experiments }),
  });
}

export function useExperimentActions(id: MaybeRefOrGetter<string>) {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: keys.experiment(toValue(id)) });
  return {
    cancel: useMutation({
      mutationFn: () => api.cancelExperiment(toValue(id)),
      onSuccess: refresh,
    }),
    retry: useMutation({ mutationFn: () => api.retryExperiment(toValue(id)), onSuccess: refresh }),
    remove: useMutation({
      mutationFn: () => api.deleteExperiment(toValue(id)),
      onSuccess: () => client.invalidateQueries({ queryKey: keys.experiments }),
    }),
  };
}

export function useSaveConfig() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, definition }: { id: string | null; definition: unknown }) =>
      id ? api.updateConfig(id, definition) : api.createConfig(definition),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.configs }),
  });
}

export function useDeleteConfig() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteConfig(id),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.configs }),
  });
}

export function useCreateSuite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (yaml: string) => api.createSuite(yaml),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.suites }),
  });
}

export function useDeleteSuite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSuite(id),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.suites }),
  });
}
