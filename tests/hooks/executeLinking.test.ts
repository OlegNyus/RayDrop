// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockXrayApi = vi.hoisted(() => ({
  addTestsToTestPlan: vi.fn(),
  addTestsToTestExecution: vi.fn(),
  addTestsToTestSet: vi.fn(),
  addTestsToFolder: vi.fn(),
  addPreconditionsToTest: vi.fn(),
  getTestLinks: vi.fn(),
}));

vi.mock('../../client/src/services/api', () => ({
  xrayApi: mockXrayApi,
}));

import { executeLinking, countLinks } from '../../client/src/hooks/useImportToXray';
import type { XrayLinking } from '../../client/src/types';

// Minimal empty linking config
const emptyLinking: XrayLinking = {
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
};

// Full linking config
const fullLinking: XrayLinking = {
  testPlanIds: ['plan-1', 'plan-2'],
  testPlanDisplays: [
    { id: 'plan-1', display: 'PROJ-10: Plan A' },
    { id: 'plan-2', display: 'PROJ-11: Plan B' },
  ],
  testExecutionIds: ['exec-1'],
  testExecutionDisplays: [
    { id: 'exec-1', display: 'PROJ-20: Exec 1' },
  ],
  testSetIds: ['set-1'],
  testSetDisplays: [
    { id: 'set-1', display: 'PROJ-30: Set 1' },
  ],
  preconditionIds: ['pre-1', 'pre-2'],
  preconditionDisplays: [
    { id: 'pre-1', display: 'PROJ-40: Pre 1' },
    { id: 'pre-2', display: 'PROJ-41: Pre 2' },
  ],
  folderPath: '/Feature/Login',
  projectId: 'proj-123',
};

describe('countLinks', () => {
  it('returns 0 for empty linking config', () => {
    expect(countLinks(emptyLinking)).toBe(0);
  });

  it('counts all link types correctly', () => {
    // 2 plans + 1 exec + 1 set + 1 folder + 1 preconditions (grouped) = 6
    expect(countLinks(fullLinking)).toBe(6);
  });

  it('does not count folder when projectId is missing', () => {
    const linking = { ...fullLinking, projectId: '' };
    // 2 plans + 1 exec + 1 set + 1 preconditions = 5 (no folder)
    expect(countLinks(linking)).toBe(5);
  });

  it('does not count folder when folderPath is empty', () => {
    const linking = { ...fullLinking, folderPath: '' };
    expect(countLinks(linking)).toBe(5);
  });
});

describe('executeLinking', () => {
  const testIssueId = 'issue-999';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns empty results when no links configured', async () => {
    mockXrayApi.getTestLinks.mockResolvedValue({
      issueId: testIssueId,
      key: 'TEST-1',
      testPlans: [],
      testExecutions: [],
      testSets: [],
      preconditions: [],
    });

    const result = await executeLinking(testIssueId, emptyLinking);

    expect(result.linkedItems).toHaveLength(0);
    expect(result.failedItems).toHaveLength(0);
    expect(result.hasErrors).toBe(false);
    expect(result.validation).not.toBeNull();
    // No linking APIs should have been called
    expect(mockXrayApi.addTestsToTestPlan).not.toHaveBeenCalled();
    expect(mockXrayApi.addTestsToTestExecution).not.toHaveBeenCalled();
    expect(mockXrayApi.addTestsToTestSet).not.toHaveBeenCalled();
    expect(mockXrayApi.addTestsToFolder).not.toHaveBeenCalled();
    expect(mockXrayApi.addPreconditionsToTest).not.toHaveBeenCalled();
  });

  it('links all entity types successfully', async () => {
    mockXrayApi.addTestsToTestPlan.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addTestsToTestExecution.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addTestsToTestSet.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addTestsToFolder.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addPreconditionsToTest.mockResolvedValue({ addedPreconditions: ['pre-1', 'pre-2'] });
    mockXrayApi.getTestLinks.mockResolvedValue({
      issueId: testIssueId,
      key: 'TEST-1',
      testPlans: [{ issueId: 'plan-1', key: 'PROJ-10' }, { issueId: 'plan-2', key: 'PROJ-11' }],
      testExecutions: [{ issueId: 'exec-1', key: 'PROJ-20' }],
      testSets: [{ issueId: 'set-1', key: 'PROJ-30' }],
      preconditions: [{ issueId: 'pre-1', key: 'PROJ-40' }, { issueId: 'pre-2', key: 'PROJ-41' }],
      folder: '/Feature/Login',
    });

    const result = await executeLinking(testIssueId, fullLinking);

    expect(result.hasErrors).toBe(false);
    // 2 plans + 1 exec + 1 set + 1 folder + 1 preconditions = 6
    expect(result.linkedItems).toHaveLength(6);
    expect(result.failedItems).toHaveLength(0);

    // Verify correct API calls
    expect(mockXrayApi.addTestsToTestPlan).toHaveBeenCalledTimes(2);
    expect(mockXrayApi.addTestsToTestPlan).toHaveBeenCalledWith('plan-1', [testIssueId]);
    expect(mockXrayApi.addTestsToTestPlan).toHaveBeenCalledWith('plan-2', [testIssueId]);
    expect(mockXrayApi.addTestsToTestExecution).toHaveBeenCalledWith('exec-1', [testIssueId]);
    expect(mockXrayApi.addTestsToTestSet).toHaveBeenCalledWith('set-1', [testIssueId]);
    expect(mockXrayApi.addTestsToFolder).toHaveBeenCalledWith('proj-123', '/Feature/Login', [testIssueId]);
    expect(mockXrayApi.addPreconditionsToTest).toHaveBeenCalledWith(testIssueId, ['pre-1', 'pre-2']);

    // Validation should pass
    expect(result.validation?.isValidated).toBe(true);
    expect(result.validation?.testPlans.missing).toHaveLength(0);
    expect(result.validation?.testExecutions.missing).toHaveLength(0);
    expect(result.validation?.testSets.missing).toHaveLength(0);
    expect(result.validation?.preconditions.missing).toHaveLength(0);
    expect(result.validation?.folder.valid).toBe(true);
  });

  it('reports partial failures while continuing other links', async () => {
    // Plan 1 succeeds, plan 2 fails
    mockXrayApi.addTestsToTestPlan
      .mockResolvedValueOnce({ addedTests: [testIssueId] })
      .mockRejectedValueOnce(new Error('Plan not found'));
    mockXrayApi.addTestsToTestExecution.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addTestsToTestSet.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addTestsToFolder.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addPreconditionsToTest.mockResolvedValue({ addedPreconditions: ['pre-1', 'pre-2'] });
    mockXrayApi.getTestLinks.mockResolvedValue({
      issueId: testIssueId,
      key: 'TEST-1',
      testPlans: [{ issueId: 'plan-1', key: 'PROJ-10' }], // plan-2 missing
      testExecutions: [{ issueId: 'exec-1', key: 'PROJ-20' }],
      testSets: [{ issueId: 'set-1', key: 'PROJ-30' }],
      preconditions: [{ issueId: 'pre-1', key: 'PROJ-40' }, { issueId: 'pre-2', key: 'PROJ-41' }],
      folder: '/Feature/Login',
    });

    const result = await executeLinking(testIssueId, fullLinking);

    expect(result.hasErrors).toBe(true);
    // 1 plan + 1 exec + 1 set + 1 folder + 1 preconditions = 5 succeeded
    expect(result.linkedItems).toHaveLength(5);
    // 1 plan failed
    expect(result.failedItems).toHaveLength(1);
    expect(result.failedItems[0].label).toBe('Test Plan: PROJ-11: Plan B');
    expect(result.failedItems[0].error).toBe('Plan not found');

    // All APIs should still have been called (no early exit)
    expect(mockXrayApi.addTestsToTestExecution).toHaveBeenCalledTimes(1);
    expect(mockXrayApi.addTestsToTestSet).toHaveBeenCalledTimes(1);
    expect(mockXrayApi.addTestsToFolder).toHaveBeenCalledTimes(1);
    expect(mockXrayApi.addPreconditionsToTest).toHaveBeenCalledTimes(1);
  });

  it('detects missing links in validation', async () => {
    mockXrayApi.addTestsToTestPlan.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addTestsToTestExecution.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addTestsToTestSet.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addTestsToFolder.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addPreconditionsToTest.mockResolvedValue({ addedPreconditions: ['pre-1', 'pre-2'] });
    // Validation returns incomplete results — exec and set missing
    mockXrayApi.getTestLinks.mockResolvedValue({
      issueId: testIssueId,
      key: 'TEST-1',
      testPlans: [{ issueId: 'plan-1', key: 'PROJ-10' }, { issueId: 'plan-2', key: 'PROJ-11' }],
      testExecutions: [], // exec-1 missing
      testSets: [], // set-1 missing
      preconditions: [{ issueId: 'pre-1', key: 'PROJ-40' }, { issueId: 'pre-2', key: 'PROJ-41' }],
      folder: '/Feature/Login',
    });

    const result = await executeLinking(testIssueId, fullLinking);

    // All linking calls succeeded but validation found missing links
    expect(result.linkedItems).toHaveLength(6);
    expect(result.failedItems).toHaveLength(0);
    expect(result.hasErrors).toBe(true); // validation mismatch

    expect(result.validation?.isValidated).toBe(true);
    expect(result.validation?.testPlans.missing).toHaveLength(0);
    expect(result.validation?.testExecutions.missing).toEqual(['exec-1']);
    expect(result.validation?.testSets.missing).toEqual(['set-1']);
    expect(result.validation?.preconditions.missing).toHaveLength(0);
  });

  it('handles validation API failure gracefully', async () => {
    mockXrayApi.addTestsToTestPlan.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addTestsToTestExecution.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addTestsToTestSet.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addTestsToFolder.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addPreconditionsToTest.mockResolvedValue({ addedPreconditions: ['pre-1', 'pre-2'] });
    mockXrayApi.getTestLinks.mockRejectedValue(new Error('Network error'));

    const result = await executeLinking(testIssueId, fullLinking);

    // Linking succeeded, but validation couldn't complete
    expect(result.linkedItems).toHaveLength(6);
    expect(result.failedItems).toHaveLength(0);
    expect(result.hasErrors).toBe(false); // linking itself was fine
    expect(result.validation?.isValidated).toBe(false);
  });

  it('detects folder validation mismatch', async () => {
    mockXrayApi.addTestsToTestPlan.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addTestsToTestExecution.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addTestsToTestSet.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addTestsToFolder.mockResolvedValue({ addedTests: [testIssueId] });
    mockXrayApi.addPreconditionsToTest.mockResolvedValue({ addedPreconditions: ['pre-1', 'pre-2'] });
    mockXrayApi.getTestLinks.mockResolvedValue({
      issueId: testIssueId,
      key: 'TEST-1',
      testPlans: [{ issueId: 'plan-1', key: 'PROJ-10' }, { issueId: 'plan-2', key: 'PROJ-11' }],
      testExecutions: [{ issueId: 'exec-1', key: 'PROJ-20' }],
      testSets: [{ issueId: 'set-1', key: 'PROJ-30' }],
      preconditions: [{ issueId: 'pre-1', key: 'PROJ-40' }, { issueId: 'pre-2', key: 'PROJ-41' }],
      folder: '/WrongFolder', // doesn't match expected /Feature/Login
    });

    const result = await executeLinking(testIssueId, fullLinking);

    expect(result.hasErrors).toBe(true);
    expect(result.validation?.folder.valid).toBe(false);
    expect(result.validation?.folder.expected).toBe('/Feature/Login');
    expect(result.validation?.folder.found).toBe('/WrongFolder');
  });
});
