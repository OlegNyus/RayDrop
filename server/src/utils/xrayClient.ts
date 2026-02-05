import axios from 'axios';
import { readConfig, writeConfig } from './fileOperations.js';
import type { Config, XrayEntity, FolderNode, ImportResult, ValidationResult, Draft, TestWithDetails } from '../types.js';

const XRAY_AUTH_URL = 'https://xray.cloud.getxray.app/api/v2/authenticate';
const XRAY_IMPORT_URL = 'https://xray.cloud.getxray.app/api/v1/import/test/bulk';
const XRAY_JOB_STATUS_URL = 'https://xray.cloud.getxray.app/api/v1/import/test/bulk';
const XRAY_GRAPHQL_URL = 'https://xray.cloud.getxray.app/api/v2/graphql';

const TOKEN_EXPIRY_HOURS = 24;
const TOKEN_REFRESH_BUFFER_MINUTES = 30;

interface TokenData {
  token: string;
  timestamp: number;
}

function isTokenValid(tokenData: TokenData | undefined): boolean {
  if (!tokenData?.timestamp || !tokenData?.token) {
    return false;
  }
  const tokenAge = Date.now() - tokenData.timestamp;
  const maxAge = (TOKEN_EXPIRY_HOURS * 60 - TOKEN_REFRESH_BUFFER_MINUTES) * 60 * 1000;
  return tokenAge < maxAge;
}

async function getToken(config: Config): Promise<string> {
  if (config.tokenData && isTokenValid(config.tokenData)) {
    return config.tokenData.token;
  }

  const response = await axios.post(
    XRAY_AUTH_URL,
    {
      client_id: config.xrayClientId,
      client_secret: config.xrayClientSecret,
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    }
  );

  const token = response.data as string;

  config.tokenData = {
    token,
    timestamp: Date.now(),
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString(),
  };
  writeConfig(config);

  return token;
}

interface BulkImportPayload {
  testtype: string;
  fields: {
    summary: string;
    project: { key: string };
    description: string;
    labels: string[];
  };
  steps: Array<{
    action: string;
    data: string;
    result: string;
  }>;
}

// Code detection for Xray export formatting
type CodeLanguage = 'json' | 'javascript' | 'typescript' | 'none';

function detectCodeLanguage(text: string): CodeLanguage {
  if (!text || text.trim().length === 0) {
    return 'none';
  }

  const trimmed = text.trim();

  // Try JSON detection
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && isValidJSON(trimmed)) {
    return 'json';
  }

  // TypeScript patterns
  const tsPatterns = [
    /:\s*(string|number|boolean|any|void|never|unknown)\b/,
    /interface\s+\w+/,
    /type\s+\w+\s*=/,
  ];
  if (tsPatterns.some(p => p.test(trimmed))) {
    return 'typescript';
  }

  // JavaScript patterns
  const jsPatterns = [
    /\b(const|let|var)\s+\w+\s*=/,
    /\bfunction\s+\w*\s*\(/,
    /=>\s*[{\(]/,
    /\bexport\s+(default\s+)?/,
    /\bimport\s+.*\s+from\s+/,
    /\bclass\s+\w+/,
    /\basync\s+(function|\()/,
  ];
  if (jsPatterns.some(p => p.test(trimmed))) {
    return 'javascript';
  }

  return 'none';
}

function isValidJSON(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function formatDataForXray(data: string): string {
  if (!data) return '';

  const language = detectCodeLanguage(data);
  if (language === 'none') {
    return data;
  }

  // Wrap in Xray/Jira wiki code block format
  return `{code:${language}}\n${data}\n{code}`;
}

function toBulkImportFormat(testCases: Draft[], projectKey: string): BulkImportPayload[] {
  return testCases.map((tc) => ({
    testtype: tc.testType || 'Manual',
    fields: {
      summary: tc.summary,
      project: { key: projectKey },
      description: tc.description || '',
      labels: tc.labels || [],
    },
    steps: (tc.steps || []).map((step) => ({
      action: step.action || '',
      data: formatDataForXray(step.data || ''),
      result: step.result || '',
    })),
  }));
}

export async function validateCredentials(credentials: { xrayClientId: string; xrayClientSecret: string }): Promise<ValidationResult> {
  try {
    const response = await axios.post(
      XRAY_AUTH_URL,
      {
        client_id: credentials.xrayClientId,
        client_secret: credentials.xrayClientSecret,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );

    if (response.data) {
      return { success: true };
    }

    return { success: false, error: 'Authentication failed: No token received' };
  } catch (error) {
    const axiosError = error as { response?: { data?: { error?: string } }; message?: string };
    const errorMsg = axiosError.response?.data?.error || axiosError.message;
    if (errorMsg?.includes('Invalid client credentials')) {
      return { success: false, error: 'Invalid Client ID or Client Secret' };
    }
    return { success: false, error: `Authentication failed: ${errorMsg}` };
  }
}

export async function importToXray(testCases: Draft[], projectKey: string | null = null): Promise<ImportResult> {
  try {
    const config = readConfig();
    if (!config) {
      return { success: false, error: 'Config not found' };
    }

    let token: string;
    try {
      token = await getToken(config);
    } catch (authError) {
      const axiosError = authError as { response?: { data?: { error?: string } }; message?: string };
      const errorMsg = axiosError.response?.data?.error || axiosError.message;
      if (errorMsg?.includes('Invalid client credentials')) {
        return { success: false, error: 'Authentication failed: Invalid client credentials' };
      }
      return { success: false, error: `Authentication failed: ${errorMsg}` };
    }

    const targetProject = projectKey || testCases[0]?.projectKey;
    if (!targetProject) {
      return { success: false, error: 'No project key specified' };
    }

    const payload = toBulkImportFormat(testCases, targetProject);

    const response = await axios.post(XRAY_IMPORT_URL, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });

    if (response.data?.jobId) {
      return {
        success: true,
        jobId: response.data.jobId,
      };
    }

    return {
      success: false,
      error: 'Import completed but no jobId returned',
    };
  } catch (error) {
    const axiosError = error as { response?: { data?: { error?: string } }; message?: string };
    const errorMsg = axiosError.response?.data?.error || axiosError.message;
    return {
      success: false,
      error: `Import failed: ${errorMsg}`,
    };
  }
}

interface JobStatusResult {
  success: boolean;
  status?: string;
  testIssueIds?: string[];
  testKeys?: string[];
  error?: string;
  details?: unknown;
}

export async function getJobStatus(jobId: string, maxAttempts = 30, intervalMs = 2000): Promise<JobStatusResult> {
  const config = readConfig();
  if (!config) {
    return { success: false, error: 'Config not found' };
  }

  const token = await getToken(config);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await axios.get(`${XRAY_JOB_STATUS_URL}/${jobId}/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      const { status, result } = response.data;

      if (status === 'successful') {
        const issues = result?.issues || result?.createdIssues || [];
        const testIssueIds = issues.map((issue: { id: string }) => issue.id);
        const testKeys = issues.map((issue: { key: string }) => issue.key);
        return {
          success: true,
          status: 'successful',
          testIssueIds,
          testKeys,
        };
      }

      if (status === 'failed') {
        const errorMessage = result?.error ||
          result?.message ||
          result?.errors?.join(', ') ||
          (typeof result === 'string' ? result : JSON.stringify(result)) ||
          'Import job failed';
        console.error('Xray import job failed:', response.data);
        return {
          success: false,
          status: 'failed',
          error: errorMessage,
          details: result,
        };
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } catch (error) {
      const axiosError = error as { message?: string };
      return {
        success: false,
        error: `Failed to get job status: ${axiosError.message}`,
      };
    }
  }

  return {
    success: false,
    error: 'Job status polling timed out',
  };
}

export async function importToXrayAndWait(testCases: Draft[], projectKey: string | null = null): Promise<ImportResult> {
  const importResult = await importToXray(testCases, projectKey);

  if (!importResult.success) {
    return importResult;
  }

  const jobResult = await getJobStatus(importResult.jobId!);

  if (!jobResult.success) {
    return {
      success: false,
      jobId: importResult.jobId,
      error: jobResult.error,
    };
  }

  return {
    success: true,
    jobId: importResult.jobId,
    testIssueIds: jobResult.testIssueIds,
    testKeys: jobResult.testKeys,
  };
}

// ============ GraphQL Functions ============

async function executeGraphQL<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const config = readConfig();
  if (!config) {
    throw new Error('Config not found');
  }

  const token = await getToken(config);

  const response = await axios.post(
    XRAY_GRAPHQL_URL,
    { query, variables },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  if (response.data.errors) {
    throw new Error(response.data.errors[0]?.message || 'GraphQL error');
  }

  return response.data.data as T;
}

export interface TestPlanWithCount extends XrayEntity {
  testCount: number;
}

export async function getTestPlans(projectKey: string): Promise<TestPlanWithCount[]> {
  const query = `
    query GetTestPlans($jql: String!, $limit: Int!) {
      getTestPlans(jql: $jql, limit: $limit) {
        total
        results {
          issueId
          jira(fields: ["key", "summary"])
          tests(limit: 1) {
            total
          }
        }
      }
    }
  `;

  interface Result {
    getTestPlans: {
      results: Array<{
        issueId: string;
        jira?: { key: string; summary: string };
        tests?: { total: number };
      }>;
    };
  }

  const data = await executeGraphQL<Result>(query, {
    jql: `project = '${projectKey}'`,
    limit: 100,
  });

  return data.getTestPlans.results.map((tp) => ({
    issueId: tp.issueId,
    key: tp.jira?.key || '',
    summary: tp.jira?.summary || '',
    testCount: tp.tests?.total || 0,
  }));
}

export interface TestExecutionWithStatus extends XrayEntity {
  totalTests: number;
  statuses: Array<{ status: string; count: number; color: string }>;
}

export async function getTestExecutions(projectKey: string): Promise<TestExecutionWithStatus[]> {
  // First get the test executions
  const execQuery = `
    query GetTestExecutions($jql: String!, $limit: Int!) {
      getTestExecutions(jql: $jql, limit: $limit) {
        total
        results {
          issueId
          jira(fields: ["key", "summary"])
        }
      }
    }
  `;

  interface ExecResult {
    getTestExecutions: {
      results: Array<{ issueId: string; jira?: { key: string; summary: string } }>;
    };
  }

  const execData = await executeGraphQL<ExecResult>(execQuery, {
    jql: `project = '${projectKey}'`,
    limit: 100,
  });

  const executions = execData.getTestExecutions.results;

  if (executions.length === 0) {
    return [];
  }

  // Get all test run statuses in a single batch request
  const issueIds = executions.map(e => e.issueId);

  const runsQuery = `
    query GetTestRuns($testExecIssueIds: [String]!, $limit: Int!) {
      getTestRuns(testExecIssueIds: $testExecIssueIds, limit: $limit) {
        total
        results {
          status {
            name
            color
          }
          testExecution {
            issueId
          }
        }
      }
    }
  `;

  interface RunsResult {
    getTestRuns: {
      total: number;
      results: Array<{
        status?: { name: string; color?: string };
        testExecution?: { issueId: string };
      }>;
    } | null;
  }

  const runsData = await executeGraphQL<RunsResult>(runsQuery, {
    testExecIssueIds: issueIds,
    limit: 5000, // High limit to get all runs
  });

  // Group runs by execution
  const statusByExecution: Record<string, Record<string, { count: number; color: string }>> = {};
  const totalByExecution: Record<string, number> = {};

  for (const run of runsData.getTestRuns?.results || []) {
    const execId = run.testExecution?.issueId;
    if (!execId) continue;

    if (!statusByExecution[execId]) {
      statusByExecution[execId] = {};
      totalByExecution[execId] = 0;
    }

    totalByExecution[execId]++;
    const statusName = run.status?.name || 'TODO';

    if (!statusByExecution[execId][statusName]) {
      statusByExecution[execId][statusName] = {
        count: 0,
        color: run.status?.color || STATUS_COLORS[statusName.toUpperCase()] || '#6B7280',
      };
    }
    statusByExecution[execId][statusName].count++;
  }

  // Build the result
  return executions.map((te) => {
    const statuses = Object.entries(statusByExecution[te.issueId] || {})
      .map(([status, data]) => ({ status, ...data }))
      .sort((a, b) => b.count - a.count);

    return {
      issueId: te.issueId,
      key: te.jira?.key || '',
      summary: te.jira?.summary || '',
      totalTests: totalByExecution[te.issueId] || 0,
      statuses,
    };
  });
}

export interface TestSetWithCount extends XrayEntity {
  testCount: number;
}

export async function getTestSets(projectKey: string): Promise<TestSetWithCount[]> {
  const query = `
    query GetTestSets($jql: String!, $limit: Int!) {
      getTestSets(jql: $jql, limit: $limit) {
        total
        results {
          issueId
          jira(fields: ["key", "summary"])
          tests(limit: 1) {
            total
          }
        }
      }
    }
  `;

  interface Result {
    getTestSets: {
      results: Array<{
        issueId: string;
        jira?: { key: string; summary: string };
        tests?: { total: number };
      }>;
    };
  }

  const data = await executeGraphQL<Result>(query, {
    jql: `project = '${projectKey}'`,
    limit: 100,
  });

  return data.getTestSets.results.map((ts) => ({
    issueId: ts.issueId,
    key: ts.jira?.key || '',
    summary: ts.jira?.summary || '',
    testCount: ts.tests?.total || 0,
  }));
}

export async function getPreconditions(projectKey: string): Promise<XrayEntity[]> {
  const query = `
    query GetPreconditions($jql: String!, $limit: Int!) {
      getPreconditions(jql: $jql, limit: $limit) {
        total
        results {
          issueId
          jira(fields: ["key", "summary"])
        }
      }
    }
  `;

  interface Result {
    getPreconditions: {
      results: Array<{ issueId: string; jira?: { key: string; summary: string } }>;
    };
  }

  const data = await executeGraphQL<Result>(query, {
    jql: `project = '${projectKey}'`,
    limit: 100,
  });

  return data.getPreconditions.results.map((pc) => ({
    issueId: pc.issueId,
    key: pc.jira?.key || '',
    summary: pc.jira?.summary || '',
  }));
}

export async function getFolders(projectId: string, path = '/'): Promise<FolderNode> {
  const query = `
    query GetFolder($projectId: String!, $path: String!) {
      getFolder(projectId: $projectId, path: $path) {
        name
        path
        testsCount
        folders
      }
    }
  `;

  interface Result {
    getFolder: FolderNode;
  }

  const data = await executeGraphQL<Result>(query, { projectId, path });
  return data.getFolder;
}

export async function getProjectId(projectKey: string): Promise<string> {
  const query = `
    query GetProjectSettings($projectIdOrKey: String!) {
      getProjectSettings(projectIdOrKey: $projectIdOrKey) {
        projectId
      }
    }
  `;

  interface Result {
    getProjectSettings: { projectId: string };
  }

  const data = await executeGraphQL<Result>(query, { projectIdOrKey: projectKey });

  if (data.getProjectSettings?.projectId) {
    return data.getProjectSettings.projectId;
  }

  throw new Error(`Could not resolve project ID for ${projectKey}`);
}

// ============ Mutation Functions ============

export async function addTestsToTestPlan(testPlanId: string, testIssueIds: string[]): Promise<{ addedTests: number; warning?: string }> {
  const mutation = `
    mutation AddTestsToTestPlan($issueId: String!, $testIssueIds: [String]!) {
      addTestsToTestPlan(issueId: $issueId, testIssueIds: $testIssueIds) {
        addedTests
        warning
      }
    }
  `;

  interface Result {
    addTestsToTestPlan: { addedTests: number; warning?: string };
  }

  const data = await executeGraphQL<Result>(mutation, { issueId: testPlanId, testIssueIds });
  return data.addTestsToTestPlan;
}

export async function addTestsToTestExecution(testExecutionId: string, testIssueIds: string[]): Promise<{ addedTests: number; warning?: string }> {
  const mutation = `
    mutation AddTestsToTestExecution($issueId: String!, $testIssueIds: [String]!) {
      addTestsToTestExecution(issueId: $issueId, testIssueIds: $testIssueIds) {
        addedTests
        warning
      }
    }
  `;

  interface Result {
    addTestsToTestExecution: { addedTests: number; warning?: string };
  }

  const data = await executeGraphQL<Result>(mutation, { issueId: testExecutionId, testIssueIds });
  return data.addTestsToTestExecution;
}

export async function addTestsToTestSet(testSetId: string, testIssueIds: string[]): Promise<{ addedTests: number; warning?: string }> {
  const mutation = `
    mutation AddTestsToTestSet($issueId: String!, $testIssueIds: [String]!) {
      addTestsToTestSet(issueId: $issueId, testIssueIds: $testIssueIds) {
        addedTests
        warning
      }
    }
  `;

  interface Result {
    addTestsToTestSet: { addedTests: number; warning?: string };
  }

  const data = await executeGraphQL<Result>(mutation, { issueId: testSetId, testIssueIds });
  return data.addTestsToTestSet;
}

export async function addTestsToFolder(projectId: string, folderPath: string, testIssueIds: string[]): Promise<{ folder: FolderNode; warnings?: string[] }> {
  const mutation = `
    mutation AddTestsToFolder($projectId: String!, $path: String!, $testIssueIds: [String]!) {
      addTestsToFolder(projectId: $projectId, path: $path, testIssueIds: $testIssueIds) {
        folder {
          name
          path
          testsCount
        }
        warnings
      }
    }
  `;

  interface Result {
    addTestsToFolder: { folder: FolderNode; warnings?: string[] };
  }

  const data = await executeGraphQL<Result>(mutation, { projectId, path: folderPath, testIssueIds });
  return data.addTestsToFolder;
}

export async function addPreconditionsToTest(testIssueId: string, preconditionIssueIds: string[]): Promise<{ addedPreconditions: number; warning?: string }> {
  const mutation = `
    mutation AddPreconditionsToTest($issueId: String!, $preconditionIssueIds: [String]!) {
      addPreconditionsToTest(issueId: $issueId, preconditionIssueIds: $preconditionIssueIds) {
        addedPreconditions
        warning
      }
    }
  `;

  interface Result {
    addPreconditionsToTest: { addedPreconditions: number; warning?: string };
  }

  const data = await executeGraphQL<Result>(mutation, { issueId: testIssueId, preconditionIssueIds });
  return data.addPreconditionsToTest;
}

export async function removeTestsFromTestPlan(testPlanId: string, testIssueIds: string[]): Promise<{ removedTests: number; warning?: string }> {
  const mutation = `
    mutation RemoveTestsFromTestPlan($issueId: String!, $testIssueIds: [String]!) {
      removeTestsFromTestPlan(issueId: $issueId, testIssueIds: $testIssueIds) {
        removedTests
        warning
      }
    }
  `;

  interface Result {
    removeTestsFromTestPlan: { removedTests: number; warning?: string };
  }

  const data = await executeGraphQL<Result>(mutation, { issueId: testPlanId, testIssueIds });
  return data.removeTestsFromTestPlan;
}

export async function removeTestsFromTestExecution(testExecutionId: string, testIssueIds: string[]): Promise<{ removedTests: number; warning?: string }> {
  const mutation = `
    mutation RemoveTestsFromTestExecution($issueId: String!, $testIssueIds: [String]!) {
      removeTestsFromTestExecution(issueId: $issueId, testIssueIds: $testIssueIds) {
        removedTests
        warning
      }
    }
  `;

  interface Result {
    removeTestsFromTestExecution: { removedTests: number; warning?: string };
  }

  const data = await executeGraphQL<Result>(mutation, { issueId: testExecutionId, testIssueIds });
  return data.removeTestsFromTestExecution;
}

export async function removeTestsFromTestSet(testSetId: string, testIssueIds: string[]): Promise<{ removedTests: number; warning?: string }> {
  const mutation = `
    mutation RemoveTestsFromTestSet($issueId: String!, $testIssueIds: [String]!) {
      removeTestsFromTestSet(issueId: $issueId, testIssueIds: $testIssueIds) {
        removedTests
        warning
      }
    }
  `;

  interface Result {
    removeTestsFromTestSet: { removedTests: number; warning?: string };
  }

  const data = await executeGraphQL<Result>(mutation, { issueId: testSetId, testIssueIds });
  return data.removeTestsFromTestSet;
}

export async function removeTestsFromFolder(projectId: string, folderPath: string, testIssueIds: string[]): Promise<{ folder: FolderNode; warnings?: string[] }> {
  const mutation = `
    mutation RemoveTestsFromFolder($projectId: String!, $path: String!, $testIssueIds: [String]!) {
      removeTestsFromFolder(projectId: $projectId, path: $path, testIssueIds: $testIssueIds) {
        folder {
          name
          path
          testsCount
        }
        warnings
      }
    }
  `;

  interface Result {
    removeTestsFromFolder: { folder: FolderNode; warnings?: string[] };
  }

  const data = await executeGraphQL<Result>(mutation, { projectId, path: folderPath, testIssueIds });
  return data.removeTestsFromFolder;
}

export async function removePreconditionsFromTest(testIssueId: string, preconditionIssueIds: string[]): Promise<{ removedPreconditions: number; warning?: string }> {
  const mutation = `
    mutation RemovePreconditionsFromTest($issueId: String!, $preconditionIssueIds: [String]!) {
      removePreconditionsFromTest(issueId: $issueId, preconditionIssueIds: $preconditionIssueIds) {
        removedPreconditions
        warning
      }
    }
  `;

  interface Result {
    removePreconditionsFromTest: { removedPreconditions: number; warning?: string };
  }

  const data = await executeGraphQL<Result>(mutation, { issueId: testIssueId, preconditionIssueIds });
  return data.removePreconditionsFromTest;
}

// ============ Get Tests from Entities ============

export interface TestWithStatus extends XrayEntity {
  status?: string;
  statusColor?: string;
}

export async function getTestsFromTestSet(testSetId: string): Promise<TestWithStatus[]> {
  const query = `
    query GetTestSet($issueId: String!) {
      getTestSet(issueId: $issueId) {
        tests(limit: 100) {
          total
          results {
            issueId
            jira(fields: ["key", "summary", "status"])
          }
        }
      }
    }
  `;

  interface Result {
    getTestSet: {
      tests: {
        total: number;
        results: Array<{
          issueId: string;
          jira?: {
            key: string;
            summary: string;
            status?: { name: string; statusCategory?: { colorName?: string } };
          };
        }>;
      };
    };
  }

  const data = await executeGraphQL<Result>(query, { issueId: testSetId });
  const results = data.getTestSet?.tests?.results || [];
  return results.map((t) => ({
    issueId: t.issueId,
    key: t.jira?.key || '',
    summary: t.jira?.summary || '',
    status: t.jira?.status?.name,
    statusColor: getJiraStatusColor(t.jira?.status?.statusCategory?.colorName),
  }));
}

export async function getTestsFromTestPlan(testPlanId: string): Promise<TestWithStatus[]> {
  const query = `
    query GetTestPlan($issueId: String!) {
      getTestPlan(issueId: $issueId) {
        tests(limit: 100) {
          total
          results {
            issueId
            jira(fields: ["key", "summary", "status"])
          }
        }
      }
    }
  `;

  interface Result {
    getTestPlan: {
      tests: {
        total: number;
        results: Array<{
          issueId: string;
          jira?: {
            key: string;
            summary: string;
            status?: { name: string; statusCategory?: { colorName?: string } };
          };
        }>;
      };
    };
  }

  const data = await executeGraphQL<Result>(query, { issueId: testPlanId });
  const results = data.getTestPlan?.tests?.results || [];
  return results.map((t) => ({
    issueId: t.issueId,
    key: t.jira?.key || '',
    summary: t.jira?.summary || '',
    status: t.jira?.status?.name,
    statusColor: getJiraStatusColor(t.jira?.status?.statusCategory?.colorName),
  }));
}

export async function getTestsFromTestExecution(testExecutionId: string): Promise<TestWithStatus[]> {
  const query = `
    query GetTestExecution($issueId: String!) {
      getTestExecution(issueId: $issueId) {
        tests(limit: 100) {
          total
          results {
            issueId
            status {
              name
              color
            }
            jira(fields: ["key", "summary"])
          }
        }
      }
    }
  `;

  interface Result {
    getTestExecution: {
      tests: {
        total: number;
        results: Array<{
          issueId: string;
          status?: { name: string; color?: string };
          jira?: { key: string; summary: string };
        }>;
      };
    };
  }

  const data = await executeGraphQL<Result>(query, { issueId: testExecutionId });
  const results = data.getTestExecution?.tests?.results || [];
  return results.map((t) => ({
    issueId: t.issueId,
    key: t.jira?.key || '',
    summary: t.jira?.summary || '',
    status: t.status?.name,
    statusColor: t.status?.color,
  }));
}

export async function getTestsFromPrecondition(preconditionId: string): Promise<TestWithStatus[]> {
  const query = `
    query GetPrecondition($issueId: String!) {
      getPrecondition(issueId: $issueId) {
        tests(limit: 100) {
          total
          results {
            issueId
            jira(fields: ["key", "summary", "status"])
          }
        }
      }
    }
  `;

  interface Result {
    getPrecondition: {
      tests: {
        total: number;
        results: Array<{
          issueId: string;
          jira?: {
            key: string;
            summary: string;
            status?: { name: string; statusCategory?: { colorName?: string } };
          };
        }>;
      };
    };
  }

  const data = await executeGraphQL<Result>(query, { issueId: preconditionId });
  const results = data.getPrecondition?.tests?.results || [];
  return results.map((t) => ({
    issueId: t.issueId,
    key: t.jira?.key || '',
    summary: t.jira?.summary || '',
    status: t.jira?.status?.name,
    statusColor: getJiraStatusColor(t.jira?.status?.statusCategory?.colorName),
  }));
}

// ============ Get Test Details ============

export interface TestStep {
  id: string;
  action: string;
  data: string;
  result: string;
}

export interface TestDetails {
  issueId: string;
  key: string;
  summary: string;
  description: string;
  testType: string;
  priority: string;
  labels: string[];
  steps: TestStep[];
}

export async function getTestDetails(issueId: string): Promise<TestDetails> {
  const query = `
    query GetTest($issueId: String!) {
      getTest(issueId: $issueId) {
        issueId
        testType {
          name
        }
        steps {
          id
          action
          data
          result
        }
        jira(fields: ["key", "summary", "description", "priority", "labels"])
      }
    }
  `;

  interface Result {
    getTest: {
      issueId: string;
      testType?: { name: string };
      steps?: Array<{ id: string; action: string; data: string; result: string }>;
      jira?: {
        key: string;
        summary: string;
        description: string;
        priority?: { name: string };
        labels?: string[];
      };
    };
  }

  const data = await executeGraphQL<Result>(query, { issueId });
  const test = data.getTest;

  return {
    issueId: test.issueId,
    key: test.jira?.key || '',
    summary: test.jira?.summary || '',
    description: test.jira?.description || '',
    testType: test.testType?.name || 'Manual',
    priority: test.jira?.priority?.name || '',
    labels: test.jira?.labels || [],
    steps: (test.steps || []).map((s) => ({
      id: s.id,
      action: s.action || '',
      data: s.data || '',
      result: s.result || '',
    })),
  };
}

// ============ Get Test With All Links (for validation) ============

export interface TestLinks {
  issueId: string;
  key: string;
  testPlans: Array<{ issueId: string; key: string }>;
  testExecutions: Array<{ issueId: string; key: string }>;
  testSets: Array<{ issueId: string; key: string }>;
  preconditions: Array<{ issueId: string; key: string }>;
  folder?: string;
}

export async function getTestWithLinks(issueId: string): Promise<TestLinks> {
  const query = `
    query GetTestWithLinks($issueId: String!) {
      getTest(issueId: $issueId) {
        issueId
        jira(fields: ["key"])
        folder {
          path
        }
        testPlans(limit: 100) {
          results {
            issueId
            jira(fields: ["key"])
          }
        }
        testSets(limit: 100) {
          results {
            issueId
            jira(fields: ["key"])
          }
        }
        testExecutions(limit: 100) {
          results {
            issueId
            jira(fields: ["key"])
          }
        }
        preconditions(limit: 100) {
          results {
            issueId
            jira(fields: ["key"])
          }
        }
      }
    }
  `;

  interface LinkedEntity {
    issueId: string;
    jira?: { key: string };
  }

  interface Result {
    getTest: {
      issueId: string;
      jira?: { key: string };
      folder?: { path: string };
      testPlans?: { results: LinkedEntity[] };
      testSets?: { results: LinkedEntity[] };
      testExecutions?: { results: LinkedEntity[] };
      preconditions?: { results: LinkedEntity[] };
    };
  }

  const data = await executeGraphQL<Result>(query, { issueId });
  const test = data.getTest;

  const mapEntity = (e: LinkedEntity) => ({
    issueId: e.issueId,
    key: e.jira?.key || '',
  });

  return {
    issueId: test.issueId,
    key: test.jira?.key || '',
    testPlans: (test.testPlans?.results || []).map(mapEntity),
    testExecutions: (test.testExecutions?.results || []).map(mapEntity),
    testSets: (test.testSets?.results || []).map(mapEntity),
    preconditions: (test.preconditions?.results || []).map(mapEntity),
    folder: test.folder?.path,
  };
}

// ============ Get Precondition Details ============

export interface PreconditionDetails {
  issueId: string;
  key: string;
  summary: string;
  description: string;
  preconditionType: string;
  definition: string;
  priority: string;
  labels: string[];
}

// ============ Get Test Execution Status Summary ============

export interface TestRunStatus {
  status: string;
  count: number;
  color: string;
}

export interface TestExecutionStatusSummary {
  issueId: string;
  key: string;
  summary: string;
  totalTests: number;
  statuses: TestRunStatus[];
}

// Status colors matching Xray's conventions for test run statuses
const STATUS_COLORS: Record<string, string> = {
  PASS: '#22C55E',      // green
  PASSED: '#22C55E',
  FAIL: '#EF4444',      // red
  FAILED: '#EF4444',
  TODO: '#6B7280',      // gray
  EXECUTING: '#3B82F6', // blue
  ABORTED: '#F59E0B',   // amber
  BLOCKED: '#EC4899',   // pink
  PENDING: '#8B5CF6',   // purple
};

// Status colors for test case workflow statuses (Ready, Draft, etc.)
const TC_STATUS_COLORS: Record<string, string> = {
  READY: '#22C55E',           // green
  DRAFT: '#F59E0B',           // amber
  'UNDER REVIEW': '#3B82F6',  // blue
  APPROVED: '#10B981',        // emerald
  DEPRECATED: '#6B7280',      // gray
  OBSOLETE: '#6B7280',        // gray
  UNKNOWN: '#9CA3AF',         // light gray
};

// Map Jira status category colors to hex
function getJiraStatusColor(colorName?: string): string {
  const colorMap: Record<string, string> = {
    'blue-gray': '#6B7280',   // To Do
    'yellow': '#F59E0B',      // In Progress / Draft
    'green': '#22C55E',       // Done / Ready
    'medium-gray': '#9CA3AF', // Unknown
  };
  return colorMap[colorName || ''] || '#6B7280';
}

export async function getTestExecutionStatusSummary(issueId: string): Promise<TestExecutionStatusSummary> {
  // First get the test execution details
  const execQuery = `
    query GetTestExecution($issueId: String!) {
      getTestExecution(issueId: $issueId) {
        issueId
        jira(fields: ["key", "summary"])
      }
    }
  `;

  // Then get test runs with status using getTestRuns query
  const runsQuery = `
    query GetTestRuns($testExecIssueIds: [String]!, $limit: Int!) {
      getTestRuns(testExecIssueIds: $testExecIssueIds, limit: $limit) {
        total
        results {
          status {
            name
            color
          }
        }
      }
    }
  `;

  interface ExecResult {
    getTestExecution: {
      issueId: string;
      jira?: { key: string; summary: string };
    } | null;
  }

  interface RunsResult {
    getTestRuns: {
      total: number;
      results: Array<{ status?: { name: string; color?: string } }>;
    } | null;
  }

  const [execData, runsData] = await Promise.all([
    executeGraphQL<ExecResult>(execQuery, { issueId }),
    executeGraphQL<RunsResult>(runsQuery, { testExecIssueIds: [issueId], limit: 1000 }),
  ]);

  const execution = execData.getTestExecution;
  const runs = runsData.getTestRuns;

  if (!execution) {
    return {
      issueId,
      key: '',
      summary: '',
      totalTests: 0,
      statuses: [],
    };
  }

  // Count statuses
  const statusCounts: Record<string, { count: number; color: string }> = {};

  for (const run of runs?.results || []) {
    const statusName = run.status?.name || 'TODO';
    if (!statusCounts[statusName]) {
      statusCounts[statusName] = {
        count: 0,
        color: run.status?.color || STATUS_COLORS[statusName.toUpperCase()] || '#6B7280',
      };
    }
    statusCounts[statusName].count++;
  }

  const statuses: TestRunStatus[] = Object.entries(statusCounts).map(([status, data]) => ({
    status,
    count: data.count,
    color: data.color,
  }));

  // Sort by count descending
  statuses.sort((a, b) => b.count - a.count);

  return {
    issueId: execution.issueId,
    key: execution.jira?.key || '',
    summary: execution.jira?.summary || '',
    totalTests: runs?.total || 0,
    statuses,
  };
}

export async function getPreconditionDetails(issueId: string): Promise<PreconditionDetails> {
  const query = `
    query GetPrecondition($issueId: String!) {
      getPrecondition(issueId: $issueId) {
        issueId
        preconditionType {
          name
        }
        definition
        jira(fields: ["key", "summary", "description", "priority", "labels"])
      }
    }
  `;

  interface Result {
    getPrecondition: {
      issueId: string;
      preconditionType?: { name: string };
      definition?: string;
      jira?: {
        key: string;
        summary: string;
        description: string;
        priority?: { name: string };
        labels?: string[];
      };
    };
  }

  const data = await executeGraphQL<Result>(query, { issueId });
  const precondition = data.getPrecondition;

  return {
    issueId: precondition.issueId,
    key: precondition.jira?.key || '',
    summary: precondition.jira?.summary || '',
    description: precondition.jira?.description || '',
    preconditionType: precondition.preconditionType?.name || 'Manual',
    definition: precondition.definition || '',
    priority: precondition.jira?.priority?.name || '',
    labels: precondition.jira?.labels || [],
  };
}

// ============ Get Tests by Jira Status ============

export async function getTestsByStatus(projectKey: string, status: string): Promise<TestWithDetails[]> {
  const query = `
    query GetTests($jql: String!, $limit: Int!) {
      getTests(jql: $jql, limit: $limit) {
        total
        results {
          issueId
          jira(fields: ["key", "summary", "priority", "labels", "assignee", "created", "updated"])
        }
      }
    }
  `;

  interface Result {
    getTests: {
      total: number;
      results: Array<{
        issueId: string;
        jira?: {
          key: string;
          summary: string;
          priority?: { name: string; iconUrl?: string };
          labels?: string[];
          assignee?: { displayName: string; avatarUrls?: { '24x24'?: string } };
          created: string;
          updated: string;
        };
      }>;
    };
  }

  // Use JQL to filter by project, type=Test, and status
  const jql = `project = '${projectKey}' AND issuetype = Test AND status = '${status}'`;

  const data = await executeGraphQL<Result>(query, {
    jql,
    limit: 200,
  });

  return data.getTests.results.map((t) => ({
    issueId: t.issueId,
    key: t.jira?.key || '',
    summary: t.jira?.summary || '',
    priority: t.jira?.priority?.name || 'Medium',
    priorityIconUrl: t.jira?.priority?.iconUrl,
    labels: t.jira?.labels || [],
    assignee: t.jira?.assignee?.displayName,
    assigneeAvatarUrl: t.jira?.assignee?.avatarUrls?.['24x24'],
    created: t.jira?.created || '',
    updated: t.jira?.updated || '',
  }));
}
