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

import { getTestPlanStatusSummary } from '../../server/src/utils/xrayClient';

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

// Convenience builders that match the GraphQL response shape executeGraphQL expects:
// `response.data.data.<rootField>`
const gql = (data: unknown) => ({ data: { data } });

const meta = (totalTests: number, totalExecutions: number, key = 'WCP-1', summary = 'Plan summary') =>
  gql({
    getTestPlan: {
      issueId: 'plan-1',
      jira: { key, summary },
      tests: { total: totalTests },
      testExecutions: { total: totalExecutions },
    },
  });

const metaNull = () => gql({ getTestPlan: null });

const planTestsPage = (testIds: string[]) =>
  gql({ getTestPlan: { tests: { results: testIds.map((id) => ({ issueId: id })) } } });

const execPage = (execs: Array<{ issueId: string; key: string }>) =>
  gql({
    getTestPlan: {
      testExecutions: {
        results: execs.map((e) => ({ issueId: e.issueId, jira: { key: e.key } })),
      },
    },
  });

interface RunFixture {
  testId: string;
  execId: string;
  status: string;
  color?: string;
}

const runsPage = (runs: RunFixture[], total: number) =>
  gql({
    getTestRuns: {
      total,
      results: runs.map((r) => ({
        test: { issueId: r.testId },
        testExecution: { issueId: r.execId },
        status: { name: r.status, color: r.color },
      })),
    },
  });

const findStatus = (
  statuses: Array<{ status: string; count: number }>,
  name: string,
) => statuses.find((s) => s.status === name);

describe('getTestPlanStatusSummary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockReadConfig.mockReturnValue(VALID_CONFIG);
    mockWriteConfig.mockImplementation(() => {});
    mockGetProjectSettings.mockReturnValue({});
  });

  it('TC-PlanStatus-U001: picks most-recent non-TODO run as final status per test', async () => {
    // Plan: 1 test in 2 executions. Older exec (WCP-100) = PASSED, newer (WCP-200) = FAILED.
    // Expect FAILED to win as the final status (most recent non-TODO).
    mockAxiosPost.mockResolvedValueOnce(meta(1, 2));
    mockAxiosPost.mockResolvedValueOnce(planTestsPage(['test-1']));
    mockAxiosPost.mockResolvedValueOnce(
      execPage([
        { issueId: 'exec-100', key: 'WCP-100' },
        { issueId: 'exec-200', key: 'WCP-200' },
      ]),
    );
    mockAxiosPost.mockResolvedValueOnce(
      runsPage(
        [
          { testId: 'test-1', execId: 'exec-100', status: 'PASSED' },
          { testId: 'test-1', execId: 'exec-200', status: 'FAILED' },
        ],
        2,
      ),
    );

    const result = await getTestPlanStatusSummary('plan-1');

    expect(result.totalTests).toBe(1);
    expect(findStatus(result.statuses, 'FAILED')?.count).toBe(1);
    expect(findStatus(result.statuses, 'PASSED')).toBeUndefined();
  });

  it('TC-PlanStatus-U002: leaves a test as TODO when all its runs are TODO', async () => {
    mockAxiosPost.mockResolvedValueOnce(meta(1, 2));
    mockAxiosPost.mockResolvedValueOnce(planTestsPage(['test-1']));
    mockAxiosPost.mockResolvedValueOnce(
      execPage([
        { issueId: 'exec-100', key: 'WCP-100' },
        { issueId: 'exec-200', key: 'WCP-200' },
      ]),
    );
    mockAxiosPost.mockResolvedValueOnce(
      runsPage(
        [
          { testId: 'test-1', execId: 'exec-100', status: 'TODO' },
          { testId: 'test-1', execId: 'exec-200', status: 'TODO' },
        ],
        2,
      ),
    );

    const result = await getTestPlanStatusSummary('plan-1');

    expect(findStatus(result.statuses, 'TODO')?.count).toBe(1);
    expect(findStatus(result.statuses, 'NOT RUN')).toBeUndefined();
  });

  it('TC-PlanStatus-U003: buckets plan tests with no runs as NOT RUN', async () => {
    // 2 plan tests, but only test-1 has runs. test-2 should bucket as NOT RUN.
    mockAxiosPost.mockResolvedValueOnce(meta(2, 1));
    mockAxiosPost.mockResolvedValueOnce(planTestsPage(['test-1', 'test-2']));
    mockAxiosPost.mockResolvedValueOnce(
      execPage([{ issueId: 'exec-100', key: 'WCP-100' }]),
    );
    mockAxiosPost.mockResolvedValueOnce(
      runsPage([{ testId: 'test-1', execId: 'exec-100', status: 'PASSED' }], 1),
    );

    const result = await getTestPlanStatusSummary('plan-1');

    expect(findStatus(result.statuses, 'PASSED')?.count).toBe(1);
    expect(findStatus(result.statuses, 'NOT RUN')?.count).toBe(1);
  });

  it('TC-PlanStatus-U004: paginates plan tests until totalTests is exhausted', async () => {
    // 250 plan tests → 3 pages of planTestsQuery (100, 100, 50)
    mockAxiosPost.mockResolvedValueOnce(meta(250, 0));
    const ids1 = Array.from({ length: 100 }, (_, i) => `t-${i}`);
    const ids2 = Array.from({ length: 100 }, (_, i) => `t-${100 + i}`);
    const ids3 = Array.from({ length: 50 }, (_, i) => `t-${200 + i}`);
    mockAxiosPost.mockResolvedValueOnce(planTestsPage(ids1));
    mockAxiosPost.mockResolvedValueOnce(planTestsPage(ids2));
    mockAxiosPost.mockResolvedValueOnce(planTestsPage(ids3));
    // No executions → exec loop skipped, but runs do-while still fires once with empty array
    mockAxiosPost.mockResolvedValueOnce(runsPage([], 0));

    const result = await getTestPlanStatusSummary('plan-1');

    const planTestsCalls = mockAxiosPost.mock.calls.filter((call) => {
      const body = call[1] as { query: string };
      return body.query.includes('GetTestPlanTests');
    });
    expect(planTestsCalls).toHaveLength(3);
    // All 250 plan tests with no runs become NOT RUN
    expect(findStatus(result.statuses, 'NOT RUN')?.count).toBe(250);
    expect(result.totalTests).toBe(250);
  });

  it('TC-PlanStatus-U005: paginates testExecutions beyond the 100-per-page limit', async () => {
    // 150 executions → 2 exec pages
    mockAxiosPost.mockResolvedValueOnce(meta(0, 150));
    // 0 plan tests means planTests loop is skipped (ptStart=0 not < 0)
    const execs1 = Array.from({ length: 100 }, (_, i) => ({
      issueId: `exec-${i}`,
      key: `WCP-${100 + i}`,
    }));
    const execs2 = Array.from({ length: 50 }, (_, i) => ({
      issueId: `exec-${100 + i}`,
      key: `WCP-${200 + i}`,
    }));
    mockAxiosPost.mockResolvedValueOnce(execPage(execs1));
    mockAxiosPost.mockResolvedValueOnce(execPage(execs2));
    mockAxiosPost.mockResolvedValueOnce(runsPage([], 0));

    await getTestPlanStatusSummary('plan-1');

    const execCalls = mockAxiosPost.mock.calls.filter((call) => {
      const body = call[1] as { query: string };
      return body.query.includes('GetTestPlanExecs');
    });
    expect(execCalls).toHaveLength(2);
  });

  it('TC-PlanStatus-U006: sum of status counts always equals totalTests', async () => {
    // 5 plan tests: 2 PASSED, 1 FAILED, 1 only-TODO runs, 1 NOT RUN (no runs at all)
    mockAxiosPost.mockResolvedValueOnce(meta(5, 1));
    mockAxiosPost.mockResolvedValueOnce(
      planTestsPage(['t1', 't2', 't3', 't4', 't5']),
    );
    mockAxiosPost.mockResolvedValueOnce(
      execPage([{ issueId: 'exec-1', key: 'WCP-1' }]),
    );
    mockAxiosPost.mockResolvedValueOnce(
      runsPage(
        [
          { testId: 't1', execId: 'exec-1', status: 'PASSED' },
          { testId: 't2', execId: 'exec-1', status: 'PASSED' },
          { testId: 't3', execId: 'exec-1', status: 'FAILED' },
          { testId: 't4', execId: 'exec-1', status: 'TODO' },
          // t5 has no run at all → NOT RUN
        ],
        4,
      ),
    );

    const result = await getTestPlanStatusSummary('plan-1');

    const sum = result.statuses.reduce((a, s) => a + s.count, 0);
    expect(sum).toBe(result.totalTests);
    expect(result.totalTests).toBe(5);
  });

  it('TC-PlanStatus-U007: ignores runs for tests not in the plan (planTestIds filter)', async () => {
    // Plan contains only test-1; the run feed also returns a run for test-99 (not in plan).
    mockAxiosPost.mockResolvedValueOnce(meta(1, 1));
    mockAxiosPost.mockResolvedValueOnce(planTestsPage(['test-1']));
    mockAxiosPost.mockResolvedValueOnce(
      execPage([{ issueId: 'exec-1', key: 'WCP-1' }]),
    );
    mockAxiosPost.mockResolvedValueOnce(
      runsPage(
        [
          { testId: 'test-1', execId: 'exec-1', status: 'PASSED' },
          { testId: 'test-99', execId: 'exec-1', status: 'FAILED' },
        ],
        2,
      ),
    );

    const result = await getTestPlanStatusSummary('plan-1');

    expect(findStatus(result.statuses, 'PASSED')?.count).toBe(1);
    expect(findStatus(result.statuses, 'FAILED')).toBeUndefined();
    expect(result.totalTests).toBe(1);
  });

  it('TC-PlanStatus-U008: returns empty summary when getTestPlan returns null', async () => {
    mockAxiosPost.mockResolvedValueOnce(metaNull());

    const result = await getTestPlanStatusSummary('missing-plan');

    expect(result).toEqual({
      issueId: 'missing-plan',
      key: '',
      summary: '',
      totalTests: 0,
      totalExecutions: 0,
      statuses: [],
    });
    // Only the meta call should have happened; the function exits early.
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
  });
});
