import type { Config, ConfigInput, Settings, ProjectSettings, Draft, XrayEntity, ImportResult } from '../types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Config API
export const configApi = {
  get: () => request<Config>('/config'),
  save: (config: ConfigInput) => request<{ success: boolean }>('/config', {
    method: 'POST',
    body: JSON.stringify(config),
  }),
  delete: () => request<{ success: boolean }>('/config', { method: 'DELETE' }),
  testConnection: (credentials: { xrayClientId: string; xrayClientSecret: string }) =>
    request<{ success: boolean }>('/config/test-connection', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
};

// Settings API
export const settingsApi = {
  get: () => request<Settings>('/settings'),
  update: (settings: Settings) => request<{ success: boolean; settings: Settings }>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }),
  addProject: (projectKey: string, color?: string) => request<{ success: boolean }>('/settings/projects', {
    method: 'POST',
    body: JSON.stringify({ projectKey, color }),
  }),
  hideProject: (projectKey: string) => request<{ success: boolean }>(`/settings/projects/${projectKey}/hide`, {
    method: 'POST',
  }),
  unhideProject: (projectKey: string) => request<{ success: boolean }>(`/settings/projects/${projectKey}/unhide`, {
    method: 'POST',
  }),
  setActiveProject: (projectKey: string) => request<{ success: boolean }>('/settings/active-project', {
    method: 'POST',
    body: JSON.stringify({ projectKey }),
  }),
  getProjectSettings: (projectKey: string) => request<ProjectSettings>(`/settings/projects/${projectKey}`),
  updateProjectSettings: (projectKey: string, settings: ProjectSettings) =>
    request<{ success: boolean }>(`/settings/projects/${projectKey}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
};

// Drafts API
export const draftsApi = {
  list: (projectKey?: string) => request<Draft[]>(`/drafts${projectKey ? `?project=${projectKey}` : ''}`),
  get: (id: string) => request<Draft>(`/drafts/${id}`),
  create: (draft: Draft) => request<{ success: boolean; draft: Draft }>('/drafts', {
    method: 'POST',
    body: JSON.stringify(draft),
  }),
  update: (id: string, draft: Draft) => request<{ success: boolean; draft: Draft }>(`/drafts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(draft),
  }),
  delete: (id: string) => request<{ success: boolean }>(`/drafts/${id}`, { method: 'DELETE' }),
  deleteAll: () => request<{ success: boolean }>('/drafts', { method: 'DELETE' }),
};

// Functional Areas API
export const functionalAreasApi = {
  get: () => request<{ success: boolean; areas: string[] }>('/settings/functional-areas'),
  save: (areas: string[]) => request<{ success: boolean }>('/settings/functional-areas', {
    method: 'PUT',
    body: JSON.stringify({ areas }),
  }),
};

// Helper functions for backward compatibility
export async function fetchFunctionalAreas(): Promise<{ success: boolean; areas: string[] }> {
  try {
    return await functionalAreasApi.get();
  } catch {
    return { success: false, areas: [] };
  }
}

export async function saveFunctionalAreas(areas: string[]): Promise<{ success: boolean }> {
  return functionalAreasApi.save(areas);
}

// Labels API
export const labelsApi = {
  get: () => request<{ success: boolean; labels: string[] }>('/settings/labels'),
  save: (labels: string[]) => request<{ success: boolean }>('/settings/labels', {
    method: 'PUT',
    body: JSON.stringify({ labels }),
  }),
};

// Helper functions for backward compatibility
export async function fetchLabels(): Promise<{ success: boolean; labels: string[] }> {
  try {
    return await labelsApi.get();
  } catch {
    return { success: false, labels: [] };
  }
}

export async function saveLabels(labels: string[]): Promise<{ success: boolean }> {
  return labelsApi.save(labels);
}

// Xray API
export const xrayApi = {
  import: (draftIds: string[], projectKey?: string) => request<ImportResult>('/xray/import', {
    method: 'POST',
    body: JSON.stringify({ draftIds, projectKey }),
  }),
  getTestPlans: (projectKey: string) => request<XrayEntity[]>(`/xray/test-plans/${projectKey}`),
  getTestExecutions: (projectKey: string) => request<XrayEntity[]>(`/xray/test-executions/${projectKey}`),
  getTestSets: (projectKey: string) => request<XrayEntity[]>(`/xray/test-sets/${projectKey}`),
  getPreconditions: (projectKey: string) => request<XrayEntity[]>(`/xray/preconditions/${projectKey}`),
};
