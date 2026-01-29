// ============ Config Types ============

export interface Config {
  xrayClientId: string;
  xrayClientSecret: string;
  jiraBaseUrl: string;
  tokenData?: TokenData;
}

export interface TokenData {
  token: string;
  timestamp: number;
  expiresAt: string;
}

// ============ Settings Types ============

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
}

export interface Collection {
  id: string;
  name: string;
  color: string;
}

// ============ Draft Types ============

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
}

// ============ Xray Types ============

export interface XrayEntity {
  issueId: string;
  key: string;
  summary: string;
}

export interface FolderNode {
  name: string;
  path: string;
  testsCount: number;
  folders: string[];
}

export interface ImportResult {
  success: boolean;
  jobId?: string;
  testIssueIds?: string[];
  testKeys?: string[];
  error?: string;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
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
