import { test, expect, type Page } from '@playwright/test';

const MOCK_CONFIG = { configured: true, clientId: 'test', clientSecret: 'test', subdomain: 'test' };
const MOCK_SETTINGS = {
  activeProject: 'WCP',
  projects: ['WCP'],
  hiddenProjects: [],
  projectSettings: {
    WCP: { functionalAreas: [], labels: [], collections: [], color: '#3b82f6', reusablePrefix: '' },
  },
};

const MOCK_TEST_PLANS = [
  { issueId: '60001', key: 'WCP-9860', summary: 'WCP | 4.5.0 release - May 26, 2026', testCount: 45 },
  { issueId: '60002', key: 'WCP-9800', summary: 'WCP | 4.4.0 release - April 27, 2026', testCount: 279 },
];

const MOCK_PLAN_STATUS = {
  issueId: '60001',
  key: 'WCP-9860',
  summary: 'WCP | 4.5.0 release - May 26, 2026',
  totalTests: 45,
  totalExecutions: 9,
  statuses: [
    { status: 'PASSED', count: 20, color: '#95C160' },
    { status: 'TO DO', count: 20, color: '#A2A6AE' },
    { status: 'FAILED', count: 5, color: '#D45D52' },
  ],
};

async function setupMockRoutes(page: Page) {
  await page.route(/\/api\/config$/, route => route.fulfill({ json: MOCK_CONFIG }));
  await page.route(/\/api\/settings$/, route => route.fulfill({ json: MOCK_SETTINGS }));
  await page.route(/\/api\/drafts/, route => route.fulfill({ json: [] }));
  await page.route(/\/api\/xray\/review-counts\//, route => route.fulfill({ json: { underReview: 0, draft: 0 } }));
  await page.route(/\/api\/xray\/test-executions\/WCP$/, route => route.fulfill({ json: [] }));
  await page.route(/\/api\/xray\/test-plans\/WCP$/, route => route.fulfill({ json: MOCK_TEST_PLANS }));
  await page.route(/\/api\/xray\/test-plan\/60001\/status/, route => route.fulfill({ json: MOCK_PLAN_STATUS }));
}

test.describe('Dashboard — Release Status Widget', () => {
  test('renders Release Status header and plan selector', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/dashboard');

    await expect(page.getByText('Release Status')).toBeVisible();
    await expect(page.getByText('Test Plan from Xray')).toBeVisible();
  });

  test('shows status breakdown with correct counts', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/dashboard');

    const widget = page.getByTestId('dashboard-plan-status-content');
    await expect(widget).toBeVisible();

    await expect(widget.getByText('20').first()).toBeVisible();
    await expect(widget.getByText('PASSED')).toBeVisible();
    await expect(widget.getByText('5', { exact: true })).toBeVisible();
    await expect(widget.getByText('FAILED')).toBeVisible();
    await expect(widget.getByText('TO DO')).toBeVisible();
  });

  test('shows total tests and execution count in footer', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/dashboard');

    const widget = page.getByTestId('dashboard-plan-status-content');
    await expect(widget).toBeVisible();

    await expect(widget.getByText('45')).toBeVisible();
    await expect(widget.getByText('9 test executions')).toBeVisible();
  });

  test('shows Jira link to test plan', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/dashboard');

    const widget = page.getByTestId('dashboard-plan-status-content');
    await expect(widget).toBeVisible();

    await expect(widget.getByText('WCP-9860')).toBeVisible();
  });

  test('shows stacked progress bar', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/dashboard');

    const widget = page.getByTestId('dashboard-plan-status-content');
    await expect(widget).toBeVisible();

    const bar = widget.locator('.rounded-full.overflow-hidden.flex');
    await expect(bar).toBeVisible();
    const segments = bar.locator('div');
    await expect(segments).toHaveCount(3);
  });

  test('shows empty state when no test plans exist', async ({ page }) => {
    await page.route(/\/api\/config$/, route => route.fulfill({ json: MOCK_CONFIG }));
    await page.route(/\/api\/settings$/, route => route.fulfill({ json: MOCK_SETTINGS }));
    await page.route(/\/api\/drafts/, route => route.fulfill({ json: [] }));
    await page.route(/\/api\/xray\/review-counts\//, route => route.fulfill({ json: { underReview: 0, draft: 0 } }));
    await page.route(/\/api\/xray\/test-executions\/WCP$/, route => route.fulfill({ json: [] }));
    await page.route(/\/api\/xray\/test-plans\/WCP$/, route => route.fulfill({ json: [] }));

    await page.goto('/dashboard');

    await expect(page.getByText('No test plans found in WCP')).toBeVisible();
  });
});
