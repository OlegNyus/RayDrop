// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAxiosPost = vi.hoisted(() => vi.fn());
const mockAxiosGet = vi.hoisted(() => vi.fn());
const mockReadConfig = vi.hoisted(() => vi.fn());
const mockWriteConfig = vi.hoisted(() => vi.fn());
const mockGetProjectSettings = vi.hoisted(() => vi.fn());
const mockSaveProjectSettings = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: { post: mockAxiosPost, get: mockAxiosGet },
}));

vi.mock('../../server/src/utils/fileOperations.js', () => ({
  readConfig: mockReadConfig,
  writeConfig: mockWriteConfig,
  getProjectSettings: mockGetProjectSettings,
  saveProjectSettings: mockSaveProjectSettings,
}));

import { getTestsByPrefix, getTestDetails } from '../../server/src/utils/xrayClient';

const VALID_CONFIG = {
  xrayClientId: 'test-id',
  xrayClientSecret: 'test-secret',
  jiraBaseUrl: 'https://test.atlassian.net/',
  tokenData: {
    token: 'valid-token',
    timestamp: Date.now(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
};

const EMPTY_PROJECT_SETTINGS = {
  functionalAreas: [],
  labels: [],
  collections: [],
  color: '',
  reusablePrefix: 'REUSE',
  automationStatusFieldId: '',
};

describe('TC-XrayQuery-U001: getTestsByPrefix includes automation status', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockReadConfig.mockReturnValue(VALID_CONFIG);
    mockWriteConfig.mockImplementation(() => {});
  });

  it('includes automation field in GraphQL query when field ID is cached', async () => {
    mockGetProjectSettings.mockReturnValue({
      ...EMPTY_PROJECT_SETTINGS,
      automationStatusFieldId: 'customfield_11254',
    });

    mockAxiosPost.mockResolvedValue({
      data: {
        data: {
          getTests: {
            total: 1,
            results: [{
              issueId: '10001',
              testType: { name: 'Manual' },
              steps: [{ id: 's1', action: 'Do something', data: '', result: 'Expected' }],
              jira: {
                key: 'WCP-1000',
                summary: 'REUSE Login Test',
                description: 'Test description',
                priority: { name: 'High' },
                labels: ['Regression'],
                customfield_11254: { value: 'Automated' },
              },
            }],
          },
        },
      },
    });

    const results = await getTestsByPrefix('WCP', 'REUSE');

    // Verify the GraphQL query included customfield_11254
    const graphqlCall = mockAxiosPost.mock.calls.find(
      (call: unknown[]) => (call[0] as string).includes('graphql')
    );
    expect(graphqlCall).toBeDefined();
    const queryBody = graphqlCall![1] as { query: string };
    expect(queryBody.query).toContain('customfield_11254');

    // Verify automationStatus was extracted from the response
    expect(results).toHaveLength(1);
    expect(results[0].automationStatus).toBe('Automated');
    expect(results[0].key).toBe('WCP-1000');
  });

  it('omits automation field from GraphQL query when field ID is not cached', async () => {
    mockGetProjectSettings.mockReturnValue({ ...EMPTY_PROJECT_SETTINGS });

    mockAxiosPost.mockResolvedValue({
      data: {
        data: {
          getTests: {
            total: 1,
            results: [{
              issueId: '10001',
              testType: { name: 'Manual' },
              steps: [],
              jira: {
                key: 'WCP-1000',
                summary: 'REUSE Login Test',
                description: 'Test description',
                priority: { name: 'Medium' },
                labels: [],
              },
            }],
          },
        },
      },
    });

    const results = await getTestsByPrefix('WCP', 'REUSE');

    // Verify the GraphQL query did NOT include any customfield
    const graphqlCall = mockAxiosPost.mock.calls.find(
      (call: unknown[]) => (call[0] as string).includes('graphql')
    );
    const queryBody = graphqlCall![1] as { query: string };
    expect(queryBody.query).not.toContain('customfield_');

    // automationStatus should be undefined
    expect(results[0].automationStatus).toBeUndefined();
  });

  it('returns undefined automationStatus when field is cached but value is null in response', async () => {
    mockGetProjectSettings.mockReturnValue({
      ...EMPTY_PROJECT_SETTINGS,
      automationStatusFieldId: 'customfield_11254',
    });

    mockAxiosPost.mockResolvedValue({
      data: {
        data: {
          getTests: {
            total: 1,
            results: [{
              issueId: '10001',
              testType: { name: 'Manual' },
              steps: [],
              jira: {
                key: 'WCP-1000',
                summary: 'REUSE Login Test',
                description: '',
                priority: { name: 'Medium' },
                labels: [],
                customfield_11254: null,
              },
            }],
          },
        },
      },
    });

    const results = await getTestsByPrefix('WCP', 'REUSE');
    expect(results[0].automationStatus).toBeUndefined();
  });
});

describe('TC-XrayQuery-U002: getTestDetails with projectKey parameter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockReadConfig.mockReturnValue(VALID_CONFIG);
    mockWriteConfig.mockImplementation(() => {});
  });

  it('includes automation field when projectKey is provided and field ID is cached', async () => {
    mockGetProjectSettings.mockReturnValue({
      ...EMPTY_PROJECT_SETTINGS,
      automationStatusFieldId: 'customfield_11254',
    });

    mockAxiosPost.mockResolvedValue({
      data: {
        data: {
          getTest: {
            issueId: '10001',
            testType: { name: 'Manual' },
            steps: [{ id: 's1', action: 'Open page', data: '', result: 'Page opens' }],
            jira: {
              key: 'WCP-1000',
              summary: 'Test case summary',
              description: 'Test description',
              priority: { name: 'High' },
              labels: ['Smoke'],
              customfield_11254: { value: 'In Progress' },
            },
          },
        },
      },
    });

    const result = await getTestDetails('10001', 'WCP');

    // Verify the GraphQL query included customfield_11254
    const graphqlCall = mockAxiosPost.mock.calls.find(
      (call: unknown[]) => (call[0] as string).includes('graphql')
    );
    const queryBody = graphqlCall![1] as { query: string };
    expect(queryBody.query).toContain('customfield_11254');

    expect(result.automationStatus).toBe('In Progress');
    expect(result.key).toBe('WCP-1000');
    expect(result.priority).toBe('High');
  });

  it('does not include automation field when projectKey is not provided', async () => {
    mockAxiosPost.mockResolvedValue({
      data: {
        data: {
          getTest: {
            issueId: '10001',
            testType: { name: 'Automated' },
            steps: [],
            jira: {
              key: 'WCP-1000',
              summary: 'Test case summary',
              description: '',
              priority: { name: 'Medium' },
              labels: [],
            },
          },
        },
      },
    });

    const result = await getTestDetails('10001');

    // getProjectSettings should NOT have been called
    expect(mockGetProjectSettings).not.toHaveBeenCalled();

    // Verify the GraphQL query did NOT include any customfield
    const graphqlCall = mockAxiosPost.mock.calls.find(
      (call: unknown[]) => (call[0] as string).includes('graphql')
    );
    const queryBody = graphqlCall![1] as { query: string };
    expect(queryBody.query).not.toContain('customfield_');

    expect(result.automationStatus).toBeUndefined();
    expect(result.testType).toBe('Automated');
  });

  it('does not include automation field when projectKey is provided but field ID is empty', async () => {
    mockGetProjectSettings.mockReturnValue({ ...EMPTY_PROJECT_SETTINGS });

    mockAxiosPost.mockResolvedValue({
      data: {
        data: {
          getTest: {
            issueId: '10001',
            testType: { name: 'Manual' },
            steps: [],
            jira: {
              key: 'WCP-1000',
              summary: 'Test case summary',
              description: '',
              priority: { name: 'Low' },
              labels: [],
            },
          },
        },
      },
    });

    const result = await getTestDetails('10001', 'WCP');

    // getProjectSettings was called but returned empty field ID
    expect(mockGetProjectSettings).toHaveBeenCalledWith('WCP');

    const graphqlCall = mockAxiosPost.mock.calls.find(
      (call: unknown[]) => (call[0] as string).includes('graphql')
    );
    const queryBody = graphqlCall![1] as { query: string };
    expect(queryBody.query).not.toContain('customfield_');

    expect(result.automationStatus).toBeUndefined();
  });
});
