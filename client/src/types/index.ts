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

