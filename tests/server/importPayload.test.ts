// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAxiosPost = vi.hoisted(() => vi.fn());
const mockReadConfig = vi.hoisted(() => vi.fn());
const mockWriteConfig = vi.hoisted(() => vi.fn());
const mockGetProjectSettings = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: { post: mockAxiosPost, get: vi.fn() },
}));

vi.mock('../../server/src/utils/fileOperations.js', () => ({
  readConfig: mockReadConfig,
  writeConfig: mockWriteConfig,
  getProjectSettings: mockGetProjectSettings,
}));

import { importToXray, updateExistingTest } from '../../server/src/utils/xrayClient';
import type { Draft } from '../../server/src/types';

function makeDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: 'draft-1',
    summary: 'Area | Layer | Test summary',
    description: 'Test description',
    testType: 'Manual',
    priority: 'High',
    labels: ['Regression'],
    collectionId: null,
    steps: [{ id: 's1', action: 'Do something', data: '', result: 'Something happens' }],
    xrayLinking: {
      testPlanIds: [],
      testPlanDisplays: [],
      testExecutionIds: [],
      testExecutionDisplays: [],
      testSetIds: [],
      testSetDisplays: [],
      preconditionIds: [],
      preconditionDisplays: [],
      folderPath: '/',
      projectId: '',
    },
    status: 'ready',
    updatedAt: Date.now(),
    createdAt: Date.now(),
    isComplete: true,
    projectKey: 'WCP',
    ...overrides,
  };
}

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

describe('TC-Import-U001: Import payload includes priority', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockReadConfig.mockReturnValue(VALID_CONFIG);
    mockWriteConfig.mockImplementation(() => {});
    mockGetProjectSettings.mockReturnValue({
      functionalAreas: [],
      labels: [],
      collections: [],
      color: '',
      reusablePrefix: 'REUSE',
      automationStatusFieldId: '',
    });
  });

  it('sends priority in the fields object', async () => {
    mockAxiosPost.mockResolvedValue({ data: { jobId: 'job-123' } });

    const draft = makeDraft({ priority: 'High' });
    await importToXray([draft], 'WCP');

    // First call is auth (if needed), but token is valid so first call is import
    const importCall = mockAxiosPost.mock.calls.find(
      (call: unknown[]) => (call[0] as string).includes('/import/test/bulk')
    );
    expect(importCall).toBeDefined();

    const payload = importCall![1] as Array<{ fields: { priority: { name: string } } }>;
    expect(payload[0].fields.priority).toEqual({ name: 'High' });
  });

  it('defaults priority to Medium when not set', async () => {
    mockAxiosPost.mockResolvedValue({ data: { jobId: 'job-123' } });

    const draft = makeDraft({ priority: '' });
    await importToXray([draft], 'WCP');

    const importCall = mockAxiosPost.mock.calls.find(
      (call: unknown[]) => (call[0] as string).includes('/import/test/bulk')
    );
    const payload = importCall![1] as Array<{ fields: { priority: { name: string } } }>;
    expect(payload[0].fields.priority).toEqual({ name: 'Medium' });
  });

  it('sends correct testtype from draft', async () => {
    mockAxiosPost.mockResolvedValue({ data: { jobId: 'job-123' } });

    const draft = makeDraft({ testType: 'Automated' });
    await importToXray([draft], 'WCP');

    const importCall = mockAxiosPost.mock.calls.find(
      (call: unknown[]) => (call[0] as string).includes('/import/test/bulk')
    );
    const payload = importCall![1] as Array<{ testtype: string }>;
    expect(payload[0].testtype).toBe('Automated');
  });
});

describe('TC-Import-U002: Import payload includes automation status custom field', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockReadConfig.mockReturnValue(VALID_CONFIG);
    mockWriteConfig.mockImplementation(() => {});
  });

  it('includes custom field when automationStatusFieldId is configured and value is set', async () => {
    mockGetProjectSettings.mockReturnValue({
      functionalAreas: [],
      labels: [],
      collections: [],
      color: '',
      reusablePrefix: 'REUSE',
      automationStatusFieldId: 'customfield_11254',
    });
    mockAxiosPost.mockResolvedValue({ data: { jobId: 'job-123' } });

    const draft = makeDraft({ automationStatus: 'Automated' });
    await importToXray([draft], 'WCP');

    const importCall = mockAxiosPost.mock.calls.find(
      (call: unknown[]) => (call[0] as string).includes('/import/test/bulk')
    );
    const payload = importCall![1] as Array<{ fields: Record<string, unknown> }>;
    expect(payload[0].fields['customfield_11254']).toEqual({ value: 'Automated' });
  });

  it('omits custom field when automationStatusFieldId is not configured', async () => {
    mockGetProjectSettings.mockReturnValue({
      functionalAreas: [],
      labels: [],
      collections: [],
      color: '',
      reusablePrefix: 'REUSE',
      automationStatusFieldId: '',
    });
    mockAxiosPost.mockResolvedValue({ data: { jobId: 'job-123' } });

    const draft = makeDraft({ automationStatus: 'Automated' });
    await importToXray([draft], 'WCP');

    const importCall = mockAxiosPost.mock.calls.find(
      (call: unknown[]) => (call[0] as string).includes('/import/test/bulk')
    );
    const payload = importCall![1] as Array<{ fields: Record<string, unknown> }>;
    expect(payload[0].fields['customfield_11254']).toBeUndefined();
  });

  it('omits custom field when automationStatus value is empty', async () => {
    mockGetProjectSettings.mockReturnValue({
      functionalAreas: [],
      labels: [],
      collections: [],
      color: '',
      reusablePrefix: 'REUSE',
      automationStatusFieldId: 'customfield_11254',
    });
    mockAxiosPost.mockResolvedValue({ data: { jobId: 'job-123' } });

    const draft = makeDraft({ automationStatus: '' });
    await importToXray([draft], 'WCP');

    const importCall = mockAxiosPost.mock.calls.find(
      (call: unknown[]) => (call[0] as string).includes('/import/test/bulk')
    );
    const payload = importCall![1] as Array<{ fields: Record<string, unknown> }>;
    expect(payload[0].fields['customfield_11254']).toBeUndefined();
  });
});

describe('TC-Import-U003: updateExistingTest includes priority and custom field', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockReadConfig.mockReturnValue(VALID_CONFIG);
    mockWriteConfig.mockImplementation(() => {});
  });

  it('sends priority in update payload', async () => {
    mockGetProjectSettings.mockReturnValue({
      functionalAreas: [],
      labels: [],
      collections: [],
      color: '',
      reusablePrefix: 'REUSE',
      automationStatusFieldId: '',
    });
    // Mock import call returning jobId, then job status returning success
    mockAxiosPost.mockResolvedValue({ data: { jobId: 'job-456' } });
    // Mock the GET call for job status
    const mockAxiosGet = vi.fn().mockResolvedValue({
      data: {
        status: 'successful',
        result: { issues: [{ id: '10001', key: 'WCP-1234' }] },
      },
    });
    const axios = await import('axios');
    (axios.default as unknown as { get: typeof mockAxiosGet }).get = mockAxiosGet;

    const draft = makeDraft({
      priority: 'Highest',
      isReusable: true,
      sourceTestKey: 'WCP-1234',
      sourceTestIssueId: '10001',
    });
    await updateExistingTest(draft);

    const importCall = mockAxiosPost.mock.calls.find(
      (call: unknown[]) => (call[0] as string).includes('/import/test/bulk')
    );
    expect(importCall).toBeDefined();
    const payload = importCall![1] as Array<{ fields: { priority: { name: string } }; update_key: string }>;
    expect(payload[0].fields.priority).toEqual({ name: 'Highest' });
    expect(payload[0].update_key).toBe('WCP-1234');
  });

  it('includes automation status custom field in update payload', async () => {
    mockGetProjectSettings.mockReturnValue({
      functionalAreas: [],
      labels: [],
      collections: [],
      color: '',
      reusablePrefix: 'REUSE',
      automationStatusFieldId: 'customfield_11254',
    });
    mockAxiosPost.mockResolvedValue({ data: { jobId: 'job-789' } });
    const mockAxiosGet = vi.fn().mockResolvedValue({
      data: {
        status: 'successful',
        result: { issues: [{ id: '10001', key: 'WCP-1234' }] },
      },
    });
    const axios = await import('axios');
    (axios.default as unknown as { get: typeof mockAxiosGet }).get = mockAxiosGet;

    const draft = makeDraft({
      automationStatus: 'Planned For Automation',
      isReusable: true,
      sourceTestKey: 'WCP-1234',
      sourceTestIssueId: '10001',
    });
    await updateExistingTest(draft);

    const importCall = mockAxiosPost.mock.calls.find(
      (call: unknown[]) => (call[0] as string).includes('/import/test/bulk')
    );
    const payload = importCall![1] as Array<{ fields: Record<string, unknown> }>;
    expect(payload[0].fields['customfield_11254']).toEqual({ value: 'Planned For Automation' });
  });
});
