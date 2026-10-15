import type {
  AgentConfigDetail,
  AgentConfigSummary,
  ApiErrorBody,
  Catalog,
  CreateExperimentInput,
  ExperimentDetail,
  ExperimentReport,
  ExperimentSummary,
  RunDetail,
  RunListQuery,
  RunSummary,
  SuiteDetail,
  SuiteSummary,
  WorkspaceFileContent,
} from '@agent-evals/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }

  /** Human-readable validation details, when the API returned any. */
  get detailLines(): string[] {
    if (Array.isArray(this.details)) {
      return this.details.map((d: { path?: string; message?: string }) =>
        d.path ? `${d.path}: ${d.message}` : String(d.message),
      );
    }
    return typeof this.details === 'string' ? this.details.split('\n') : [];
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body as Partial<ApiErrorBody> | null;
    throw new ApiError(response.status, error?.message ?? response.statusText, error?.details);
  }
  return body as T;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => !!entry[1]),
  ).toString();
  return search ? `?${search}` : '';
}

export const api = {
  catalog: () => request<Catalog>('/catalog'),

  suites: () => request<SuiteSummary[]>('/suites'),
  suite: (id: string) => request<SuiteDetail>(`/suites/${id}`),
  createSuite: (yaml: string) =>
    request<SuiteDetail>('/suites', { method: 'POST', ...json({ yaml }) }),
  deleteSuite: (id: string) => request<void>(`/suites/${id}`, { method: 'DELETE' }),

  configs: () => request<AgentConfigSummary[]>('/configs'),
  config: (id: string) => request<AgentConfigDetail>(`/configs/${id}`),
  createConfig: (definition: unknown) =>
    request<AgentConfigDetail>('/configs', { method: 'POST', ...json(definition) }),
  updateConfig: (id: string, definition: unknown) =>
    request<AgentConfigDetail>(`/configs/${id}`, { method: 'PUT', ...json(definition) }),
  deleteConfig: (id: string) => request<void>(`/configs/${id}`, { method: 'DELETE' }),

  experiments: () => request<ExperimentSummary[]>('/experiments'),
  experiment: (id: string) => request<ExperimentDetail>(`/experiments/${id}`),
  createExperiment: (input: CreateExperimentInput) =>
    request<ExperimentDetail>('/experiments', { method: 'POST', ...json(input) }),
  cancelExperiment: (id: string) =>
    request<ExperimentDetail>(`/experiments/${id}/cancel`, { method: 'POST' }),
  retryExperiment: (id: string) =>
    request<ExperimentDetail>(`/experiments/${id}/retry`, { method: 'POST' }),
  deleteExperiment: (id: string) => request<void>(`/experiments/${id}`, { method: 'DELETE' }),
  report: (id: string) => request<ExperimentReport>(`/experiments/${id}/report`),
  runs: (id: string, filters: RunListQuery = {}) =>
    request<RunSummary[]>(`/experiments/${id}/runs${query({ ...filters })}`),

  run: (id: string) => request<RunDetail>(`/runs/${id}`),
  runFile: (id: string, path: string) =>
    request<WorkspaceFileContent>(`/runs/${id}/files${query({ path })}`),
};
