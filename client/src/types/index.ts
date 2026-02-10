// Helpers

/** Safely convert a value to string — handles ADF objects, null, undefined */
export const safeString = (val: unknown): string => typeof val === 'string' ? val : '';

/** Check if a summary string has a title (not just Area | Layer) */
export const summaryHasTitle = (summary: string): boolean => {
  const parts = summary.split(' | ');
  if (parts.length === 2) return false;
  if (parts.length === 3 && !parts[2].trim()) return false;
  return summary.trim().length > 0;
};

/** Convert Xray linked entities to display format for SearchableMultiSelect */
export const mapDisplays = (items: Array<{ issueId: string; key: string; summary: string }>) =>
  items.map(i => ({ id: i.issueId, display: `${i.key}: ${i.summary}` }));

// Config Types
export interface Config {
  configured: boolean;
  jiraBaseUrl?: string;
  hasCredentials?: boolean;
}

export interface ConfigInput {
  xrayClientId: string;
  xrayClientSecret: string;
  jiraBaseUrl: string;
}

// Settings Types
export interface Settings {
  projects: string[];
  hiddenProjects: string[];
  activeProject: string | null;
  projectSettings: Record<string, ProjectSettings>;
}

export interface ProjectSettings {
  functionalAreas: string[];
  labels: string[];
  collections: Collection[];
  color: string;
  reusablePrefix: string;
}

export interface Collection {
  id: string;
  name: string;
  color: string;
}

// Draft/Test Case Types
export interface TestStep {
  id: string;
  action: string;
  data: string;
  result: string;
}

export interface XrayLinking {
  testPlanIds: string[];
  testPlanDisplays: Display[];
  testExecutionIds: string[];
  testExecutionDisplays: Display[];
  testSetIds: string[];
  testSetDisplays: Display[];
  preconditionIds: string[];
  preconditionDisplays: Display[];
  folderPath: string;
  projectId: string;
}

export interface Display {
  id: string;
  display: string;
}

export type TestCaseStatus = 'new' | 'draft' | 'ready' | 'imported';

export interface Draft {
  id: string;
  summary: string;
  description: string;
  testType: 'Manual' | 'Automated';
  priority: string;
  labels: string[];
  collectionId: string | null;
  steps: TestStep[];
  xrayLinking: XrayLinking;
  status: TestCaseStatus;
  updatedAt: number;
  createdAt: number;
  isComplete: boolean;
  projectKey: string;
  testKey?: string;
  testIssueId?: string;
  isReusable?: boolean;
  sourceTestKey?: string;
  sourceTestIssueId?: string;
}

// Xray Types
export interface XrayEntity {
  issueId: string;
  key: string;
  summary: string;
}

export interface TestWithStatus extends XrayEntity {
  status?: string;
  statusColor?: string;
}

export interface TestSetWithCount extends XrayEntity {
  testCount: number;
}

export interface TestPlanWithCount extends XrayEntity {
  testCount: number;
}

export interface TestExecutionStatus {
  status: string;
  count: number;
  color: string;
}

export interface TestExecutionWithStatus extends XrayEntity {
  totalTests: number;
  statuses: TestExecutionStatus[];
}

export interface ImportResult {
  success: boolean;
  jobId?: string;
  testIssueIds?: string[];
  testKeys?: string[];
  error?: string;
}

// Test with full details (steps, description, etc.)
export interface TestDetails {
  issueId: string;
  key: string;
  summary: string;
  description: string;
  testType: string;
  priority: string;
  labels: string[];
  steps: Array<{ id: string; action: string; data: string; result: string }>;
}

// Test with Xray linking data (for reusable TC pre-population)
export interface TestLinks {
  issueId: string;
  key: string;
  testPlans: Array<{ issueId: string; key: string; summary: string }>;
  testExecutions: Array<{ issueId: string; key: string; summary: string }>;
  testSets: Array<{ issueId: string; key: string; summary: string }>;
  preconditions: Array<{ issueId: string; key: string; summary: string }>;
  folder?: string;
}

// Test with detailed Jira fields (for TC Review page)
export interface TestWithDetails {
  issueId: string;
  key: string;
  summary: string;
  priority: string;
  priorityIconUrl?: string;
  labels: string[];
  assignee?: string;
  assigneeAvatarUrl?: string;
  created: string;
  updated: string;
}

