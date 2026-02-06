// @vitest-environment node

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Config, Draft } from '../../server/src/types';

// Hoist mock functions so they're available before module loading
const { mockPost, mockGet, mockReadConfig, mockWriteConfig } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet: vi.fn(),
  mockReadConfig: vi.fn(),
  mockWriteConfig: vi.fn(),
}));

// Mock: external HTTP client — axios lives in server/node_modules, so
// we must mock the resolved path that xrayClient.ts uses
vi.mock('axios', () => ({
  default: { post: mockPost, get: mockGet },
}));

// Mock: file system config persistence — no disk I/O in unit tests
vi.mock('../../server/src/utils/fileOperations', () => ({
  readConfig: mockReadConfig,
  writeConfig: mockWriteConfig,
}));

import {
  validateCredentials,
  importToXray,
  importToXrayAndWait,
  getJobStatus,
  getTestPlans,
  getTestExecutions,
  getTestSets,
  getPreconditions,
  getFolders,
  getProjectId,
  getTestDetails,
  getTestWithLinks,
  getTestExecutionStatusSummary,
  getPreconditionDetails,
  getTestsByStatus,
  addTestsToTestPlan,
  addTestsToFolder,
  addPreconditionsToTest,
  removeTestsFromTestExecution,
  getTestsFromTestSet,
  getTestsFromTestExecution,
} from '../../server/src/utils/xrayClient';

// --- Helpers ---

function makeConfig(overrides?: Partial<Config>): Config {
  return {
    xrayClientId: 'test-client-id',
    xrayClientSecret: 'test-client-secret',
    jiraBaseUrl: 'https://test.atlassian.net',
    ...overrides,
  };
}

function makeAuthenticatedConfig(): Config {
  return makeConfig({
    tokenData: {
      token: 'valid-test-token',
      timestamp: Date.now(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });
}

function makeExpiredTokenConfig(): Config {
  return makeConfig({
    tokenData: {
      token: 'expired-token',
      timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
  });
}

function makeDraft(overrides?: Partial<Draft>): Draft {
  return {
    id: 'draft-1',
    summary: 'Test draft',
    description: 'Test description',
    testType: 'Manual',
    priority: 'Medium',
    labels: ['smoke'],
    collectionId: null,
    steps: [
      { id: 's1', action: 'Step 1', data: 'Data 1', result: 'Expected 1' },
    ],
    xrayLinking: {
      testPlanIds: [], testPlanDisplays: [],
      testExecutionIds: [], testExecutionDisplays: [],
      testSetIds: [], testSetDisplays: [],
      preconditionIds: [], preconditionDisplays: [],
      folderPath: '', projectId: '',
    },
    status: 'draft',
    updatedAt: Date.now(),
    createdAt: Date.now(),
    isComplete: true,
    projectKey: 'PROJ',
    ...overrides,
  };
}

/** Set up mocks for a single GraphQL call with authenticated config */
function setupGraphQL(responseData: unknown) {
  mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
  mockPost.mockResolvedValue({ data: { data: responseData } });
}

/** Set up mocks for sequential GraphQL calls */
function setupGraphQLSequence(responses: unknown[]) {
  mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
  const mock = mockPost;
  for (const response of responses) {
    mock.mockResolvedValueOnce({ data: { data: response } });
  }
}

// --- Tests ---

describe('XrayClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ===== POSITIVE TESTS =====

  describe('TC-XrayClient-U001: validateCredentials returns success for valid credentials', () => {
    it('should return success when auth API responds with a token', async () => {
      mockPost.mockResolvedValue({ data: 'auth-token-123' });

      const result = await validateCredentials({
        xrayClientId: 'valid-id',
        xrayClientSecret: 'valid-secret',
      });

      expect(result).toEqual({ success: true });
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining('authenticate'),
        { client_id: 'valid-id', client_secret: 'valid-secret' },
        expect.objectContaining({ timeout: 30000 }),
      );
    });
  });

  describe('TC-XrayClient-U002: importToXray returns success with jobId', () => {
    it('should return jobId on successful bulk import', async () => {
      mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
      mockPost.mockResolvedValue({ data: { jobId: 'job-123' } });

      const result = await importToXray([makeDraft()], 'PROJ');

      expect(result).toEqual({ success: true, jobId: 'job-123' });
    });
  });

  describe('TC-XrayClient-U003: importToXray falls back to first test case projectKey', () => {
    it('should use projectKey from the first test case when none provided', async () => {
      mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
      mockPost.mockResolvedValue({ data: { jobId: 'job-456' } });

      const draft = makeDraft({ projectKey: 'FALLBACK' });
      const result = await importToXray([draft], null);

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining('import/test/bulk'),
        expect.arrayContaining([
          expect.objectContaining({
            fields: expect.objectContaining({ project: { key: 'FALLBACK' } }),
          }),
        ]),
        expect.any(Object),
      );
    });
  });

  describe('TC-XrayClient-U004: importToXray formats step data with code detection', () => {
    it('should wrap JSON data in wiki code format in the import payload', async () => {
      mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
      mockPost.mockResolvedValue({ data: { jobId: 'job-789' } });

      const draft = makeDraft({
        steps: [{ id: 's1', action: 'Send request', data: '{"key": "value"}', result: '200 OK' }],
      });

      await importToXray([draft], 'PROJ');

      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining('import/test/bulk'),
        expect.arrayContaining([
          expect.objectContaining({
            steps: [{ action: 'Send request', data: '{code:json}\n{"key": "value"}\n{code}', result: '200 OK' }],
          }),
        ]),
        expect.any(Object),
      );
    });
  });

  describe('TC-XrayClient-U005: getJobStatus returns test IDs on successful job', () => {
    it('should return testIssueIds and testKeys when job succeeds', async () => {
      mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
      mockGet.mockResolvedValue({
        data: {
          status: 'successful',
          result: { issues: [{ id: 'id-1', key: 'TEST-1' }, { id: 'id-2', key: 'TEST-2' }] },
        },
      });

      const result = await getJobStatus('job-123', 1, 0);

      expect(result).toEqual({
        success: true,
        status: 'successful',
        testIssueIds: ['id-1', 'id-2'],
        testKeys: ['TEST-1', 'TEST-2'],
      });
    });
  });

  describe('TC-XrayClient-U006: getJobStatus polls multiple times for in-progress job', () => {
    it('should retry polling until job completes', async () => {
      mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
      mockGet
        .mockResolvedValueOnce({ data: { status: 'in_progress' } })
        .mockResolvedValueOnce({ data: { status: 'in_progress' } })
        .mockResolvedValueOnce({
          data: {
            status: 'successful',
            result: { issues: [{ id: 'id-1', key: 'TEST-1' }] },
          },
        });

      const result = await getJobStatus('job-123', 5, 0);

      expect(result.success).toBe(true);
      expect(mockGet).toHaveBeenCalledTimes(3);
    });
  });

  describe('TC-XrayClient-U007: importToXrayAndWait orchestrates import + polling', () => {
    it('should import then poll and return full result with IDs', async () => {
      mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
      mockPost.mockResolvedValue({ data: { jobId: 'job-abc' } });
      mockGet.mockResolvedValue({
        data: {
          status: 'successful',
          result: { issues: [{ id: 'id-1', key: 'TEST-1' }] },
        },
      });

      const result = await importToXrayAndWait([makeDraft()], 'PROJ');

      expect(result).toEqual({
        success: true,
        jobId: 'job-abc',
        testIssueIds: ['id-1'],
        testKeys: ['TEST-1'],
      });
    });
  });

  describe('TC-XrayClient-U008: getTestPlans returns mapped plans with testCount', () => {
    it('should map GraphQL response to TestPlanWithCount[]', async () => {
      setupGraphQL({
        getTestPlans: {
          results: [
            { issueId: 'tp-1', jira: { key: 'TP-1', summary: 'Plan 1' }, tests: { total: 5 } },
            { issueId: 'tp-2', jira: { key: 'TP-2', summary: 'Plan 2' }, tests: { total: 10 } },
          ],
        },
      });

      const result = await getTestPlans('PROJ');

      expect(result).toEqual([
        { issueId: 'tp-1', key: 'TP-1', summary: 'Plan 1', testCount: 5 },
        { issueId: 'tp-2', key: 'TP-2', summary: 'Plan 2', testCount: 10 },
      ]);
    });
  });

  describe('TC-XrayClient-U009: getTestExecutions groups run statuses by execution', () => {
    it('should aggregate test run statuses per execution', async () => {
      setupGraphQLSequence([
        {
          getTestExecutions: {
            results: [{ issueId: 'te-1', jira: { key: 'TE-1', summary: 'Exec 1' } }],
          },
        },
        {
          getTestRuns: {
            total: 3,
            results: [
              { status: { name: 'PASS', color: '#22C55E' }, testExecution: { issueId: 'te-1' } },
              { status: { name: 'PASS', color: '#22C55E' }, testExecution: { issueId: 'te-1' } },
              { status: { name: 'FAIL', color: '#EF4444' }, testExecution: { issueId: 'te-1' } },
            ],
          },
        },
      ]);

      const result = await getTestExecutions('PROJ');

      expect(result).toHaveLength(1);
      expect(result[0].issueId).toBe('te-1');
      expect(result[0].totalTests).toBe(3);
      expect(result[0].statuses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: 'PASS', count: 2 }),
          expect.objectContaining({ status: 'FAIL', count: 1 }),
        ]),
      );
    });
  });

  describe('TC-XrayClient-U010: getTestSets returns mapped sets with testCount', () => {
    it('should map GraphQL response to TestSetWithCount[]', async () => {
      setupGraphQL({
        getTestSets: {
          results: [
            { issueId: 'ts-1', jira: { key: 'TS-1', summary: 'Set 1' }, tests: { total: 7 } },
          ],
        },
      });

      const result = await getTestSets('PROJ');

      expect(result).toEqual([
        { issueId: 'ts-1', key: 'TS-1', summary: 'Set 1', testCount: 7 },
      ]);
    });
  });

  describe('TC-XrayClient-U011: getPreconditions returns mapped preconditions', () => {
    it('should map GraphQL response to XrayEntity[]', async () => {
      setupGraphQL({
        getPreconditions: {
          results: [
            { issueId: 'pc-1', jira: { key: 'PC-1', summary: 'User logged in' } },
          ],
        },
      });

      const result = await getPreconditions('PROJ');

      expect(result).toEqual([
        { issueId: 'pc-1', key: 'PC-1', summary: 'User logged in' },
      ]);
    });
  });

  describe('TC-XrayClient-U012: getFolders returns folder structure', () => {
    it('should return FolderNode from GraphQL response', async () => {
      setupGraphQL({
        getFolder: { name: 'Root', path: '/', testsCount: 10, folders: [] },
      });

      const result = await getFolders('proj-123', '/');

      expect(result).toEqual({ name: 'Root', path: '/', testsCount: 10, folders: [] });
    });
  });

  describe('TC-XrayClient-U013: getProjectId resolves project key to ID', () => {
    it('should return projectId from GraphQL response', async () => {
      setupGraphQL({
        getProjectSettings: { projectId: '10001' },
      });

      const result = await getProjectId('PROJ');

      expect(result).toBe('10001');
    });
  });

  describe('TC-XrayClient-U014: getTestDetails returns mapped test with steps', () => {
    it('should return fully mapped test details', async () => {
      setupGraphQL({
        getTest: {
          issueId: 't-1',
          testType: { name: 'Manual' },
          steps: [{ id: 's1', action: 'Click', data: 'button', result: 'Opens modal' }],
          jira: {
            key: 'TEST-1',
            summary: 'Login test',
            description: 'Test login flow',
            priority: { name: 'High' },
            labels: ['smoke'],
          },
        },
      });

      const result = await getTestDetails('t-1');

      expect(result).toEqual({
        issueId: 't-1',
        key: 'TEST-1',
        summary: 'Login test',
        description: 'Test login flow',
        testType: 'Manual',
        priority: 'High',
        labels: ['smoke'],
        steps: [{ id: 's1', action: 'Click', data: 'button', result: 'Opens modal' }],
      });
    });
  });

  describe('TC-XrayClient-U015: getTestWithLinks returns all linked entity types', () => {
    it('should return test with all link types and folder', async () => {
      setupGraphQL({
        getTest: {
          issueId: 't-1',
          jira: { key: 'TEST-1' },
          folder: { path: '/Smoke' },
          testPlans: { results: [{ issueId: 'tp-1', jira: { key: 'TP-1' } }] },
          testSets: { results: [{ issueId: 'ts-1', jira: { key: 'TS-1' } }] },
          testExecutions: { results: [] },
          preconditions: { results: [{ issueId: 'pc-1', jira: { key: 'PC-1' } }] },
        },
      });

      const result = await getTestWithLinks('t-1');

      expect(result).toEqual({
        issueId: 't-1',
        key: 'TEST-1',
        testPlans: [{ issueId: 'tp-1', key: 'TP-1' }],
        testSets: [{ issueId: 'ts-1', key: 'TS-1' }],
        testExecutions: [],
        preconditions: [{ issueId: 'pc-1', key: 'PC-1' }],
        folder: '/Smoke',
      });
    });
  });

  describe('TC-XrayClient-U016: getTestExecutionStatusSummary counts statuses sorted by count', () => {
    it('should return status summary sorted descending by count', async () => {
      setupGraphQLSequence([
        {
          getTestExecution: {
            issueId: 'te-1',
            jira: { key: 'TE-1', summary: 'Sprint run' },
          },
        },
        {
          getTestRuns: {
            total: 5,
            results: [
              { status: { name: 'PASS', color: '#22C55E' } },
              { status: { name: 'PASS', color: '#22C55E' } },
              { status: { name: 'PASS', color: '#22C55E' } },
              { status: { name: 'FAIL', color: '#EF4444' } },
              { status: { name: 'TODO', color: '#6B7280' } },
            ],
          },
        },
      ]);

      const result = await getTestExecutionStatusSummary('te-1');

      expect(result.totalTests).toBe(5);
      expect(result.statuses[0]).toEqual(expect.objectContaining({ status: 'PASS', count: 3 }));
      expect(result.statuses[1]).toEqual(expect.objectContaining({ status: 'FAIL', count: 1 }));
      expect(result.statuses[2]).toEqual(expect.objectContaining({ status: 'TODO', count: 1 }));
    });
  });

  describe('TC-XrayClient-U017: getPreconditionDetails returns mapped details', () => {
    it('should return precondition with definition and type', async () => {
      setupGraphQL({
        getPrecondition: {
          issueId: 'pc-1',
          preconditionType: { name: 'Manual' },
          definition: 'User must be authenticated',
          jira: {
            key: 'PC-1',
            summary: 'Auth precondition',
            description: 'Requires login',
            priority: { name: 'High' },
            labels: ['auth'],
          },
        },
      });

      const result = await getPreconditionDetails('pc-1');

      expect(result).toEqual({
        issueId: 'pc-1',
        key: 'PC-1',
        summary: 'Auth precondition',
        description: 'Requires login',
        preconditionType: 'Manual',
        definition: 'User must be authenticated',
        priority: 'High',
        labels: ['auth'],
      });
    });
  });

  describe('TC-XrayClient-U018: getTestsByStatus returns tests with assignee info', () => {
    it('should return tests filtered by JQL status with priority and assignee', async () => {
      setupGraphQL({
        getTests: {
          total: 1,
          results: [{
            issueId: 't-1',
            jira: {
              key: 'TEST-1',
              summary: 'Login flow',
              priority: { name: 'High', iconUrl: 'https://icon.url' },
              labels: ['smoke'],
              assignee: { displayName: 'Alice', avatarUrls: { '24x24': 'https://avatar.url' } },
              created: '2024-01-01T00:00:00Z',
              updated: '2024-01-02T00:00:00Z',
            },
          }],
        },
      });

      const result = await getTestsByStatus('PROJ', 'Under Review');

      expect(result[0]).toEqual({
        issueId: 't-1',
        key: 'TEST-1',
        summary: 'Login flow',
        priority: 'High',
        priorityIconUrl: 'https://icon.url',
        labels: ['smoke'],
        assignee: 'Alice',
        assigneeAvatarUrl: 'https://avatar.url',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-02T00:00:00Z',
      });
    });
  });

  describe('TC-XrayClient-U019: addTestsToTestPlan sends mutation and returns result', () => {
    it('should execute mutation with correct variables', async () => {
      setupGraphQL({
        addTestsToTestPlan: { addedTests: 2, warning: null },
      });

      const result = await addTestsToTestPlan('tp-1', ['t-1', 't-2']);

      expect(result).toEqual({ addedTests: 2, warning: null });
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining('graphql'),
        expect.objectContaining({
          variables: { issueId: 'tp-1', testIssueIds: ['t-1', 't-2'] },
        }),
        expect.any(Object),
      );
    });
  });

  describe('TC-XrayClient-U020: addTestsToFolder sends mutation with projectId and path', () => {
    it('should pass projectId and folderPath in variables', async () => {
      setupGraphQL({
        addTestsToFolder: { folder: { name: 'Smoke', path: '/Smoke', testsCount: 3 }, warnings: null },
      });

      const result = await addTestsToFolder('proj-123', '/Smoke', ['t-1']);

      expect(result.folder.name).toBe('Smoke');
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining('graphql'),
        expect.objectContaining({
          variables: { projectId: 'proj-123', path: '/Smoke', testIssueIds: ['t-1'] },
        }),
        expect.any(Object),
      );
    });
  });

  describe('TC-XrayClient-U021: addPreconditionsToTest sends mutation and returns result', () => {
    it('should execute mutation with correct precondition IDs', async () => {
      setupGraphQL({
        addPreconditionsToTest: { addedPreconditions: 1, warning: null },
      });

      const result = await addPreconditionsToTest('t-1', ['pc-1']);

      expect(result).toEqual({ addedPreconditions: 1, warning: null });
    });
  });

  describe('TC-XrayClient-U022: removeTestsFromTestExecution sends remove mutation', () => {
    it('should execute remove mutation with correct variables', async () => {
      setupGraphQL({
        removeTestsFromTestExecution: { removedTests: 2, warning: null },
      });

      const result = await removeTestsFromTestExecution('te-1', ['t-1', 't-2']);

      expect(result).toEqual({ removedTests: 2, warning: null });
    });
  });

  describe('TC-XrayClient-U023: getTestsFromTestSet maps tests with Jira status color', () => {
    it('should map Jira status category colorName to hex color', async () => {
      setupGraphQL({
        getTestSet: {
          tests: {
            total: 1,
            results: [{
              issueId: 't-1',
              jira: {
                key: 'TEST-1',
                summary: 'Login test',
                status: { name: 'Ready', statusCategory: { colorName: 'green' } },
              },
            }],
          },
        },
      });

      const result = await getTestsFromTestSet('ts-1');

      expect(result[0]).toEqual({
        issueId: 't-1',
        key: 'TEST-1',
        summary: 'Login test',
        status: 'Ready',
        statusColor: '#22C55E',
      });
    });
  });

  describe('TC-XrayClient-U024: getTestsFromTestExecution maps tests with run status color', () => {
    it('should use status name and color directly from test run', async () => {
      setupGraphQL({
        getTestExecution: {
          tests: {
            total: 1,
            results: [{
              issueId: 't-1',
              status: { name: 'PASS', color: '#00FF00' },
              jira: { key: 'TEST-1', summary: 'Smoke test' },
            }],
          },
        },
      });

      const result = await getTestsFromTestExecution('te-1');

      expect(result[0]).toEqual({
        issueId: 't-1',
        key: 'TEST-1',
        summary: 'Smoke test',
        status: 'PASS',
        statusColor: '#00FF00',
      });
    });
  });

  describe('TC-XrayClient-U025: Token caching — reuses valid cached token', () => {
    it('should not call auth API when token is still valid', async () => {
      mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
      mockPost.mockResolvedValue({
        data: { data: { getTestSets: { results: [] } } },
      });

      await getTestSets('PROJ');

      // Only one POST: the GraphQL call. No auth POST.
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining('graphql'),
        expect.any(Object),
        expect.any(Object),
      );
      expect(mockWriteConfig).not.toHaveBeenCalled();
    });
  });

  // ===== NEGATIVE TESTS =====

  describe('TC-XrayClient-U026: validateCredentials returns invalid credentials error', () => {
    it('should return specific error for invalid client credentials', async () => {
      mockPost.mockRejectedValue({
        response: { data: { error: 'Invalid client credentials' } },
      });

      const result = await validateCredentials({
        xrayClientId: 'bad-id',
        xrayClientSecret: 'bad-secret',
      });

      expect(result).toEqual({
        success: false,
        error: 'Invalid Client ID or Client Secret',
      });
    });
  });

  describe('TC-XrayClient-U027: validateCredentials returns generic error on network failure', () => {
    it('should return auth error with the original message', async () => {
      mockPost.mockRejectedValue({
        message: 'Network Error',
      });

      const result = await validateCredentials({
        xrayClientId: 'id',
        xrayClientSecret: 'secret',
      });

      expect(result).toEqual({
        success: false,
        error: 'Authentication failed: Network Error',
      });
    });
  });

  describe('TC-XrayClient-U028: validateCredentials returns error when no token in response', () => {
    it('should return error when response data is falsy', async () => {
      mockPost.mockResolvedValue({ data: null });

      const result = await validateCredentials({
        xrayClientId: 'id',
        xrayClientSecret: 'secret',
      });

      expect(result).toEqual({
        success: false,
        error: 'Authentication failed: No token received',
      });
    });
  });

  describe('TC-XrayClient-U029: importToXray returns error when config not found', () => {
    it('should return Config not found when readConfig returns null', async () => {
      mockReadConfig.mockReturnValue(null);

      const result = await importToXray([makeDraft()], 'PROJ');

      expect(result).toEqual({ success: false, error: 'Config not found' });
    });
  });

  describe('TC-XrayClient-U030: importToXray returns error on authentication failure', () => {
    it('should return auth error when getToken fails with invalid credentials', async () => {
      mockReadConfig.mockReturnValue(makeConfig()); // no tokenData
      mockPost.mockRejectedValue({
        response: { data: { error: 'Invalid client credentials' } },
      });

      const result = await importToXray([makeDraft()], 'PROJ');

      expect(result).toEqual({
        success: false,
        error: 'Authentication failed: Invalid client credentials',
      });
    });
  });

  describe('TC-XrayClient-U031: importToXray returns error when no project key', () => {
    it('should return error when neither projectKey nor test case has one', async () => {
      mockReadConfig.mockReturnValue(makeAuthenticatedConfig());

      const draft = makeDraft({ projectKey: '' });
      const result = await importToXray([draft], null);

      expect(result).toEqual({ success: false, error: 'No project key specified' });
    });
  });

  describe('TC-XrayClient-U032: importToXray returns error when API returns no jobId', () => {
    it('should return error when response has no jobId', async () => {
      mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
      mockPost.mockResolvedValue({ data: {} });

      const result = await importToXray([makeDraft()], 'PROJ');

      expect(result).toEqual({
        success: false,
        error: 'Import completed but no jobId returned',
      });
    });
  });

  describe('TC-XrayClient-U033: importToXray returns error on import API failure', () => {
    it('should return import failed error from axios', async () => {
      mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
      mockPost.mockRejectedValue({
        response: { data: { error: 'Rate limit exceeded' } },
      });

      const result = await importToXray([makeDraft()], 'PROJ');

      expect(result).toEqual({
        success: false,
        error: 'Import failed: Rate limit exceeded',
      });
    });
  });

  describe('TC-XrayClient-U034: getJobStatus returns error when config not found', () => {
    it('should return error when readConfig returns null', async () => {
      mockReadConfig.mockReturnValue(null);

      const result = await getJobStatus('job-123', 1, 0);

      expect(result).toEqual({ success: false, error: 'Config not found' });
    });
  });

  describe('TC-XrayClient-U035: getJobStatus returns error with details on failed job', () => {
    it('should return job error message on failed status', async () => {
      mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
      mockGet.mockResolvedValue({
        data: { status: 'failed', result: { error: 'Duplicate test keys' } },
      });

      const result = await getJobStatus('job-123', 1, 0);

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Duplicate test keys');
    });
  });

  describe('TC-XrayClient-U036: getJobStatus returns timeout error after max attempts', () => {
    it('should return timeout error when job never completes', async () => {
      mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
      mockGet.mockResolvedValue({ data: { status: 'in_progress' } });

      const result = await getJobStatus('job-123', 3, 0);

      expect(result).toEqual({ success: false, error: 'Job status polling timed out' });
      expect(mockGet).toHaveBeenCalledTimes(3);
    });
  });

  describe('TC-XrayClient-U037: importToXrayAndWait returns import error when import fails', () => {
    it('should propagate import failure without polling', async () => {
      mockReadConfig.mockReturnValue(null);

      const result = await importToXrayAndWait([makeDraft()], 'PROJ');

      expect(result).toEqual({ success: false, error: 'Config not found' });
      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe('TC-XrayClient-U038: importToXrayAndWait returns job error with jobId', () => {
    it('should return job failure with jobId preserved', async () => {
      mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
      mockPost.mockResolvedValue({ data: { jobId: 'job-fail' } });
      mockGet.mockResolvedValue({
        data: { status: 'failed', result: { error: 'Import validation error' } },
      });

      const result = await importToXrayAndWait([makeDraft()], 'PROJ');

      expect(result).toEqual({
        success: false,
        jobId: 'job-fail',
        error: 'Import validation error',
      });
    });
  });

  describe('TC-XrayClient-U039: getProjectId throws when project ID not resolved', () => {
    it('should throw when GraphQL returns no projectId', async () => {
      setupGraphQL({
        getProjectSettings: { projectId: null },
      });

      await expect(getProjectId('MISSING')).rejects.toThrow(
        'Could not resolve project ID for MISSING',
      );
    });
  });

  // ===== EDGE CASES =====

  describe('TC-XrayClient-U040: getTestExecutions returns empty for no executions', () => {
    it('should return empty array when no executions exist', async () => {
      setupGraphQL({
        getTestExecutions: { results: [] },
      });

      const result = await getTestExecutions('PROJ');

      expect(result).toEqual([]);
      // Should NOT make the second GraphQL call for test runs
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });

  describe('TC-XrayClient-U041: getTestPlans handles missing jira and tests fields', () => {
    it('should default missing fields to empty values', async () => {
      setupGraphQL({
        getTestPlans: {
          results: [{ issueId: 'tp-1' }], // no jira, no tests
        },
      });

      const result = await getTestPlans('PROJ');

      expect(result).toEqual([
        { issueId: 'tp-1', key: '', summary: '', testCount: 0 },
      ]);
    });
  });

  describe('TC-XrayClient-U042: getTestDetails handles missing optional fields', () => {
    it('should default steps, labels, priority, and description', async () => {
      setupGraphQL({
        getTest: {
          issueId: 't-1',
          jira: { key: 'TEST-1', summary: 'Minimal test' },
          // no testType, no steps, no description, no priority, no labels
        },
      });

      const result = await getTestDetails('t-1');

      expect(result).toEqual({
        issueId: 't-1',
        key: 'TEST-1',
        summary: 'Minimal test',
        description: '',
        testType: 'Manual',
        priority: '',
        labels: [],
        steps: [],
      });
    });
  });

  describe('TC-XrayClient-U043: getTestExecutionStatusSummary returns empty for null execution', () => {
    it('should return zeroed summary when execution not found', async () => {
      setupGraphQLSequence([
        { getTestExecution: null },
        { getTestRuns: null },
      ]);

      const result = await getTestExecutionStatusSummary('nonexistent');

      expect(result).toEqual({
        issueId: 'nonexistent',
        key: '',
        summary: '',
        totalTests: 0,
        statuses: [],
      });
    });
  });

  describe('TC-XrayClient-U044: getJobStatus handles various failure formats', () => {
    it('should extract error from result.message when result.error is missing', async () => {
      mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
      mockGet.mockResolvedValue({
        data: { status: 'failed', result: { message: 'Validation failed for 2 tests' } },
      });

      const result = await getJobStatus('job-1', 1, 0);
      expect(result.error).toBe('Validation failed for 2 tests');
    });

    it('should join result.errors array when present', async () => {
      mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
      mockGet.mockResolvedValue({
        data: { status: 'failed', result: { errors: ['Field missing', 'Invalid format'] } },
      });

      const result = await getJobStatus('job-2', 1, 0);
      expect(result.error).toBe('Field missing, Invalid format');
    });

    it('should use string result directly when result is a string', async () => {
      mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
      mockGet.mockResolvedValue({
        data: { status: 'failed', result: 'Unexpected error occurred' },
      });

      const result = await getJobStatus('job-3', 1, 0);
      expect(result.error).toBe('Unexpected error occurred');
    });
  });

  describe('TC-XrayClient-U045: Token refresh — fetches new token when expired', () => {
    it('should authenticate and cache new token when existing token is expired', async () => {
      mockReadConfig.mockReturnValue(makeExpiredTokenConfig());
      mockPost
        .mockResolvedValueOnce({ data: 'fresh-auth-token' }) // auth call
        .mockResolvedValueOnce({ data: { data: { getTestSets: { results: [] } } } }); // GraphQL

      await getTestSets('PROJ');

      // Two POST calls: auth + GraphQL
      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(mockPost).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('authenticate'),
        expect.any(Object),
        expect.any(Object),
      );
      expect(mockWriteConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenData: expect.objectContaining({ token: 'fresh-auth-token' }),
        }),
      );
    });
  });

  describe('TC-XrayClient-U046: GraphQL function throws on GraphQL response errors', () => {
    it('should throw error from GraphQL errors array', async () => {
      mockReadConfig.mockReturnValue(makeAuthenticatedConfig());
      mockPost.mockResolvedValue({
        data: { errors: [{ message: 'Field "foo" not found' }] },
      });

      await expect(getTestSets('PROJ')).rejects.toThrow('Field "foo" not found');
    });
  });
});
