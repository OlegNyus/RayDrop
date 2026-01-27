import axios from 'axios';
import { readConfig, writeConfig } from './fileOperations.js';
import type { Config, XrayEntity, FolderNode, ImportResult, ValidationResult, Draft } from '../types.js';

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
      data: step.data || '',
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

export async function getTestPlans(projectKey: string): Promise<XrayEntity[]> {
  const query = `
    query GetTestPlans($jql: String!, $limit: Int!) {
      getTestPlans(jql: $jql, limit: $limit) {
        total
        results {
          issueId
          jira(fields: ["key", "summary"])
        }
      }
    }
  `;

  interface Result {
    getTestPlans: {
      results: Array<{ issueId: string; jira?: { key: string; summary: string } }>;
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
  }));
}

export async function getTestExecutions(projectKey: string): Promise<XrayEntity[]> {
  const query = `
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

  interface Result {
    getTestExecutions: {
      results: Array<{ issueId: string; jira?: { key: string; summary: string } }>;
    };
  }

  const data = await executeGraphQL<Result>(query, {
    jql: `project = '${projectKey}'`,
    limit: 100,
  });

  return data.getTestExecutions.results.map((te) => ({
    issueId: te.issueId,
    key: te.jira?.key || '',
    summary: te.jira?.summary || '',
  }));
}

export async function getTestSets(projectKey: string): Promise<XrayEntity[]> {
  const query = `
    query GetTestSets($jql: String!, $limit: Int!) {
      getTestSets(jql: $jql, limit: $limit) {
        total
        results {
          issueId
          jira(fields: ["key", "summary"])
        }
      }
    }
  `;

  interface Result {
    getTestSets: {
      results: Array<{ issueId: string; jira?: { key: string; summary: string } }>;
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
