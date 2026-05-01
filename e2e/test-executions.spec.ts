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

const MOCK_EXECUTIONS = [
  {
    issueId: '50001',
    key: 'WCP-9939',
    summary: 'WCP | CY | UI | Login - Automated | Huckfinn',
    totalTests: 7,
    statuses: [
      { status: 'PASSED', count: 4, color: '#95C160' },
      { status: 'FAILED', count: 3, color: '#F06969' },
    ],
  },
  {
    issueId: '50002',
    key: 'WCP-9933',
    summary: 'WCP | API | RC 4.5.0 | Manual',
    totalTests: 3,
    statuses: [
      { status: 'PASSED', count: 3, color: '#95C160' },
    ],
  },
];

const MOCK_TESTS_WCP9939 = [
  { issueId: '10001', key: 'WCP-7074', summary: 'Login with valid credentials - without 2FA', status: 'FAILED', statusColor: '#F06969' },
  { issueId: '10002', key: 'WCP-7079', summary: 'Login with incorrect username', status: 'FAILED', statusColor: '#F06969' },
  { issueId: '10003', key: 'WCP-7081', summary: 'Login with incorrect password', status: 'FAILED', statusColor: '#F06969' },
  { issueId: '10004', key: 'WCP-9194', summary: 'Login with invalid credentials', status: 'PASSED', statusColor: '#95C160' },
  { issueId: '10005', key: 'WCP-9195', summary: 'Login page - navigate to Trouble Logging In Page', status: 'PASSED', statusColor: '#95C160' },
  { issueId: '10006', key: 'WCP-9196', summary: 'Login page - navigate to Site Status Page', status: 'PASSED', statusColor: '#95C160' },
  { issueId: '10007', key: 'WCP-9197', summary: 'Login page - navigate to Release Notes Page', status: 'PASSED', statusColor: '#95C160' },
];

async function setupMockRoutes(page: Page) {
  await page.route(/\/api\/config$/, route => route.fulfill({ json: MOCK_CONFIG }));
  await page.route(/\/api\/settings$/, route => route.fulfill({ json: MOCK_SETTINGS }));
  await page.route(/\/api\/drafts/, route => route.fulfill({ json: [] }));
  await page.route(/\/api\/xray\/review-counts\//, route => route.fulfill({ json: { underReview: 0, draft: 0 } }));
  await page.route(/\/api\/xray\/test-executions\/WCP/, route => route.fulfill({ json: MOCK_EXECUTIONS }));
  await page.route(/\/api\/xray\/test-executions\/50001\/tests/, route => route.fulfill({ json: MOCK_TESTS_WCP9939 }));
  await page.route(/\/api\/xray\/test-executions\/50002\/tests/, route =>
    route.fulfill({
      json: [
        { issueId: '10008', key: 'WCP-9932', summary: 'POST /alerts alert created', status: 'PASSED', statusColor: '#95C160' },
        { issueId: '10009', key: 'WCP-9935', summary: 'GET /alerts alert retrieved', status: 'PASSED', statusColor: '#95C160' },
        { issueId: '10010', key: 'WCP-9936', summary: 'PUT /alerts alert updated', status: 'PASSED', statusColor: '#95C160' },
      ],
    })
  );
}

test.describe('Test Executions — Execution Status', () => {
  test('execution status counts match the test list', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/test-executions');

    await expect(page.getByText('WCP-9939')).toBeVisible();

    // Expand the first execution
    await page.getByText('WCP-9939').click();

    // Wait for tests to load
    await expect(page.getByText('WCP-7074')).toBeVisible();

    // Verify the status summary matches: 4 PASSED, 3 FAILED
    const statusSection = page.getByText('Execution Status').locator('..');
    await expect(statusSection.getByText(/PASSED/).getByText('4')).toBeVisible();
    await expect(statusSection.getByText(/FAILED/).getByText('3')).toBeVisible();

    // Verify no TO DO count exists (bug was showing TO DO: 4)
    await expect(statusSection.getByText(/TO DO/)).not.toBeVisible();
  });

  test('all-passed execution shows only PASSED status', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/test-executions');

    await expect(page.getByText('WCP-9933')).toBeVisible();
    await page.getByText('WCP-9933').click();

    await expect(page.getByText('WCP-9932')).toBeVisible();

    const statusSection = page.getByText('Execution Status').locator('..');
    await expect(statusSection.getByText(/PASSED/).getByText('3')).toBeVisible();
    await expect(statusSection.getByText(/FAILED/)).not.toBeVisible();
    await expect(statusSection.getByText(/TO DO/)).not.toBeVisible();
  });

  test('progress bar renders for execution with mixed statuses', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/test-executions');

    // The WCP-9939 card should show a progress bar
    const card = page.getByText('WCP-9939').locator('..').locator('..');
    await expect(card).toBeVisible();

    // 7 tests badge
    await expect(card.getByText('7 tests')).toBeVisible();
  });

  test('test list shows correct status badges', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/test-executions');

    await page.getByText('WCP-9939').click();
    await expect(page.getByText('WCP-7074')).toBeVisible();

    // Count FAILED badges in the test list
    const failedBadges = page.getByText('FAILED', { exact: true });
    await expect(failedBadges).toHaveCount(3);

    // Count PASSED badges
    const passedBadges = page.getByText('PASSED', { exact: true });
    await expect(passedBadges).toHaveCount(4);
  });
});
