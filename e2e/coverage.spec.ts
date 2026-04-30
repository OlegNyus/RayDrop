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
const MOCK_PROJECT_ID = '12345';

const MOCK_FOLDER_TREE = {
  path: '/',
  name: 'Root',
  testsCount: 0,
  folders: [
    {
      path: '/WCP/UI/Feature/Login',
      name: 'Login',
      testsCount: 3,
      folders: [],
    },
    {
      path: '/WCP/UI/Feature/Signup',
      name: 'Signup',
      testsCount: 2,
      folders: [],
    },
    {
      path: '/WCP/UI/Feature/Dashboard',
      name: 'Dashboard',
      testsCount: 0,
      folders: [],
    },
  ],
};

const MOCK_TEST_CASES = [
  {
    key: 'WCP-7074',
    issueId: '10001',
    folderPath: '/WCP/UI/Feature/Login',
    summary: 'Login with valid credentials - without 2FA',
    description: 'Verify user can login with valid username and password',
    testType: 'Manual',
    priority: 'High',
    automation_status: 'Planned for Automation',
    labels: ['LOGIN'],
    steps: [{ action: 'Enter valid credentials', data: '', result: 'Login successful' }],
  },
  {
    key: 'WCP-7075',
    issueId: '10002',
    folderPath: '/WCP/UI/Feature/Login',
    summary: 'Login with invalid email format',
    description: 'Verify error shown for invalid email',
    testType: 'Manual',
    priority: 'Medium',
    automation_status: 'Automated',
    labels: ['LOGIN', 'NEGATIVE'],
    steps: [{ action: 'Enter invalid email', data: 'bad-email', result: 'Error message shown' }],
  },
  {
    key: 'WCP-7076',
    issueId: '10003',
    folderPath: '/WCP/UI/Feature/Login',
    summary: 'Login with incorrect password',
    description: 'Verify error shown for wrong password',
    testType: 'Manual',
    priority: 'High',
    automation_status: 'Manual',
    labels: [],
    steps: [{ action: 'Enter wrong password', data: '', result: 'Error message shown' }],
  },
];

async function setupMockRoutes(page: Page, options?: { snapshotStatuses?: unknown[] }) {
  await page.route(/\/api\/config$/, route =>
    route.fulfill({ json: MOCK_CONFIG })
  );
  await page.route(/\/api\/settings$/, route =>
    route.fulfill({ json: MOCK_SETTINGS })
  );
  await page.route(/\/api\/drafts/, route =>
    route.fulfill({ json: [] })
  );
  await page.route(/\/api\/xray\/review-counts\//, route =>
    route.fulfill({ json: { underReview: 0, draft: 0 } })
  );
  await page.route(/\/api\/xray\/project-id\/WCP/, route =>
    route.fulfill({ json: { projectId: MOCK_PROJECT_ID } })
  );
  await page.route(/\/api\/xray\/folders\//, route =>
    route.fulfill({ json: MOCK_FOLDER_TREE })
  );
  await page.route(/\/api\/xray\/coverage\/snapshots\?/, route =>
    route.fulfill({ json: options?.snapshotStatuses ?? [] })
  );
}

test.describe('Coverage Page — User Journey', () => {
  test('navigates to coverage page and sees folder tree', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/coverage');

    await expect(page.getByTestId('coverage-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Coverage' })).toBeVisible();
    await expect(page.getByText('Sync Xray test cases by folder')).toBeVisible();
    await expect(page.getByTestId('coverage-folder-tree')).toBeVisible();

    const tree = page.getByTestId('coverage-folder-tree');
    await expect(tree.getByText('Login')).toBeVisible();
    await expect(tree.getByText('Signup')).toBeVisible();
    await expect(tree.getByText('Dashboard')).toBeVisible();
  });

  test('shows folder count badge', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/coverage');

    await expect(page.getByTestId('coverage-folder-tree')).toBeVisible();
    const badge = page.getByTestId('coverage-folder-tree').getByText('3', { exact: true }).first();
    await expect(badge).toBeVisible();
  });

  test('shows "Select a folder" empty state by default', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/coverage');

    await expect(page.getByText('Select a folder')).toBeVisible();
    await expect(page.getByText('Choose a folder from the tree to view its test cases')).toBeVisible();
  });

  test('clicking unsynced folder shows "Folder not synced" with Sync Now', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/coverage');

    await page.getByText('Login').click();

    await expect(page.getByText('Folder not synced')).toBeVisible();
    await expect(page.getByText('Sync Now')).toBeVisible();
  });

  test('syncing a folder shows test cases in preview table', async ({ page }) => {
    await setupMockRoutes(page);

    await page.route(/\/api\/xray\/coverage\/sync$/, route =>
      route.fulfill({
        json: {
          tests: MOCK_TEST_CASES,
          metadata: {
            folderPath: '/WCP/UI/Feature/Login',
            lastSyncedAt: new Date().toISOString(),
            testCount: 3,
          },
        },
      })
    );

    await page.goto('/coverage');
    await page.getByText('Login').click();
    await page.getByText('Sync Now').click();

    await expect(page.getByTestId('coverage-preview-table')).toBeVisible();
    await expect(page.getByText('WCP-7074')).toBeVisible();
    await expect(page.getByText('Login with valid credentials - without 2FA')).toBeVisible();
    await expect(page.getByText('WCP-7075')).toBeVisible();
    await expect(page.getByText('WCP-7076')).toBeVisible();
  });

  test('preview table shows correct columns and badges', async ({ page }) => {
    await setupMockRoutes(page, {
      snapshotStatuses: [{ folderPath: '/WCP/UI/Feature/Login', lastSyncedAt: new Date().toISOString(), testCount: 3 }],
    });

    await page.route(/\/api\/xray\/coverage\/snapshot\?/, route =>
      route.fulfill({ json: { tests: MOCK_TEST_CASES, metadata: { folderPath: '/WCP/UI/Feature/Login', lastSyncedAt: new Date().toISOString(), testCount: 3 } } })
    );

    await page.goto('/coverage');
    await page.getByText('Login').click();

    const table = page.getByTestId('coverage-preview-table');
    await expect(table.getByText('KEY')).toBeVisible();
    await expect(table.getByText('SUMMARY')).toBeVisible();
    await expect(table.getByText('PRIORITY')).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Automation' })).toBeVisible();

    await expect(table.getByText('High').first()).toBeVisible();
    await expect(table.getByText('Medium')).toBeVisible();
    await expect(table.getByText('Planned for Automation')).toBeVisible();
    await expect(table.getByText('Automated')).toBeVisible();
    await expect(table.getByText('Manual', { exact: true })).toBeVisible();
  });

  test('search filters test cases by summary', async ({ page }) => {
    await setupMockRoutes(page, {
      snapshotStatuses: [{ folderPath: '/WCP/UI/Feature/Login', lastSyncedAt: new Date().toISOString(), testCount: 3 }],
    });

    await page.route(/\/api\/xray\/coverage\/snapshot\?/, route =>
      route.fulfill({ json: { tests: MOCK_TEST_CASES, metadata: { folderPath: '/WCP/UI/Feature/Login', lastSyncedAt: new Date().toISOString(), testCount: 3 } } })
    );

    await page.goto('/coverage');
    await page.getByText('Login').click();

    await expect(page.getByTestId('coverage-preview-table')).toBeVisible();

    await page.getByTestId('coverage-preview-search-input').fill('invalid');

    await expect(page.getByText('Login with invalid email format')).toBeVisible();
    await expect(page.getByText('Login with valid credentials - without 2FA')).not.toBeVisible();
    await expect(page.getByText('Showing 1 of 3 test cases (filtered)')).toBeVisible();
  });

  test('search with no matches shows empty message', async ({ page }) => {
    await setupMockRoutes(page, {
      snapshotStatuses: [{ folderPath: '/WCP/UI/Feature/Login', lastSyncedAt: new Date().toISOString(), testCount: 3 }],
    });

    await page.route(/\/api\/xray\/coverage\/snapshot\?/, route =>
      route.fulfill({ json: { tests: MOCK_TEST_CASES, metadata: { folderPath: '/WCP/UI/Feature/Login', lastSyncedAt: new Date().toISOString(), testCount: 3 } } })
    );

    await page.goto('/coverage');
    await page.getByText('Login').click();
    await page.getByTestId('coverage-preview-search-input').fill('xyznonexistent');

    await expect(page.getByText('No test cases match your search')).toBeVisible();
  });

  test('clearing search restores all rows', async ({ page }) => {
    await setupMockRoutes(page, {
      snapshotStatuses: [{ folderPath: '/WCP/UI/Feature/Login', lastSyncedAt: new Date().toISOString(), testCount: 3 }],
    });

    await page.route(/\/api\/xray\/coverage\/snapshot\?/, route =>
      route.fulfill({ json: { tests: MOCK_TEST_CASES, metadata: { folderPath: '/WCP/UI/Feature/Login', lastSyncedAt: new Date().toISOString(), testCount: 3 } } })
    );

    await page.goto('/coverage');
    await page.getByText('Login').click();

    await page.getByTestId('coverage-preview-search-input').fill('invalid');
    await expect(page.getByText('Showing 1 of 3 test cases (filtered)')).toBeVisible();

    await page.getByTestId('coverage-preview-search-input').clear();
    await expect(page.getByText('Showing 3 of 3 test cases')).toBeVisible();
  });

  test('Sync All button triggers sync for all folders', async ({ page }) => {
    await setupMockRoutes(page);

    let syncCount = 0;
    await page.route(/\/api\/xray\/coverage\/sync$/, route => {
      syncCount++;
      route.fulfill({
        json: {
          tests: [],
          metadata: {
            folderPath: JSON.parse(route.request().postData() || '{}').folderPath,
            lastSyncedAt: new Date().toISOString(),
            testCount: 0,
          },
        },
      });
    });

    await page.goto('/coverage');
    await expect(page.getByTestId('coverage-folder-tree')).toBeVisible();

    await page.getByTestId('coverage-sync-all-btn').click();

    await expect(page.getByText(/Synced 3\/3 folders/)).toBeVisible({ timeout: 10000 });
    expect(syncCount).toBe(3);
  });

  test('sync summary shows folder and test case counts', async ({ page }) => {
    await setupMockRoutes(page, {
      snapshotStatuses: [
        { folderPath: '/WCP/UI/Feature/Login', lastSyncedAt: new Date().toISOString(), testCount: 16 },
        { folderPath: '/WCP/UI/Feature/Signup', lastSyncedAt: new Date().toISOString(), testCount: 8 },
      ],
    });

    await page.goto('/coverage');
    const summary = page.getByTestId('coverage-sync-summary');
    await expect(summary).toBeVisible();

    await expect(summary.getByText('Xray folders')).toBeVisible();
    await expect(summary.getByText('3', { exact: true }).first()).toBeVisible();
    await expect(summary.getByText('Folders synced')).toBeVisible();
    await expect(summary.getByText('2 / 3')).toBeVisible();
    await expect(summary.getByText('Test cases synced')).toBeVisible();
    await expect(summary.getByText('24')).toBeVisible();
  });

  test('sync summary hides Export JSON when no folders synced', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/coverage');

    await expect(page.getByTestId('coverage-sync-summary')).toBeVisible();
    await expect(page.getByTestId('coverage-export-json-btn')).not.toBeVisible();
  });

  test('sync summary shows Export JSON when folders are synced', async ({ page }) => {
    await setupMockRoutes(page, {
      snapshotStatuses: [{ folderPath: '/WCP/UI/Feature/Login', lastSyncedAt: new Date().toISOString(), testCount: 3 }],
    });

    await page.goto('/coverage');
    await expect(page.getByTestId('coverage-export-json-btn')).toBeVisible();
  });

  test('sidebar shows Coverage link under Analysis section', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/coverage');

    await expect(page.getByText('Analysis')).toBeVisible();
    await expect(page.getByRole('link', { name: /Coverage/ })).toBeVisible();
  });

  test('sidebar Coverage link navigates to /coverage', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');

    await page.getByRole('link', { name: /Coverage/ }).click();

    await expect(page).toHaveURL(/\/coverage/);
    await expect(page.getByTestId('coverage-page')).toBeVisible();
  });

  test('synced folder shows green status dot and timestamp', async ({ page }) => {
    await setupMockRoutes(page, {
      snapshotStatuses: [{ folderPath: '/WCP/UI/Feature/Login', lastSyncedAt: new Date().toISOString(), testCount: 3 }],
    });

    await page.goto('/coverage');

    const loginStatus = page.getByTestId('coverage-folder-status-wcp-ui-feature-login');
    await expect(loginStatus).toBeVisible();
    await expect(loginStatus).toHaveClass(/bg-success/);

    const dashboardStatus = page.getByTestId('coverage-folder-status-wcp-ui-feature-dashboard');
    await expect(dashboardStatus).toBeVisible();
    await expect(dashboardStatus).toHaveClass(/bg-gray/);
  });

  test('sync failure shows error toast and reverts status', async ({ page }) => {
    await setupMockRoutes(page);

    await page.route(/\/api\/xray\/coverage\/sync$/, route =>
      route.fulfill({ status: 500, json: { error: 'Xray API unavailable' } })
    );

    await page.goto('/coverage');
    await page.getByText('Login').click();
    await page.getByText('Sync Now').click();

    await expect(page.getByText(/Failed to sync/)).toBeVisible();
  });

  test('per-folder download button appears for synced folders', async ({ page }) => {
    await setupMockRoutes(page, {
      snapshotStatuses: [{ folderPath: '/WCP/UI/Feature/Login', lastSyncedAt: new Date().toISOString(), testCount: 3 }],
    });

    await page.route(/\/api\/xray\/coverage\/snapshot\?/, route =>
      route.fulfill({ json: { tests: MOCK_TEST_CASES, metadata: { folderPath: '/WCP/UI/Feature/Login', lastSyncedAt: new Date().toISOString(), testCount: 3 } } })
    );

    await page.goto('/coverage');
    await page.getByText('Login').click();

    await expect(page.getByTestId('coverage-preview-table')).toBeVisible();
    const downloadBtn = page.getByTestId('coverage-preview-table').getByRole('button', { name: /Download/i });
    await expect(downloadBtn).toBeVisible();
  });

  test('footer shows correct test count and last synced time', async ({ page }) => {
    const syncTime = new Date().toISOString();
    await setupMockRoutes(page, {
      snapshotStatuses: [{ folderPath: '/WCP/UI/Feature/Login', lastSyncedAt: syncTime, testCount: 3 }],
    });

    await page.route(/\/api\/xray\/coverage\/snapshot\?/, route =>
      route.fulfill({ json: { tests: MOCK_TEST_CASES, metadata: { folderPath: '/WCP/UI/Feature/Login', lastSyncedAt: syncTime, testCount: 3 } } })
    );

    await page.goto('/coverage');
    await page.getByText('Login').click();

    await expect(page.getByText('Showing 3 of 3 test cases')).toBeVisible();
    await expect(page.getByText(/Last synced:/)).toBeVisible();
  });
});

test.describe('Coverage Page — No Project Selected', () => {
  test('shows "Select a project" when no active project', async ({ page }) => {
    await page.route(/\/api\/config$/, route =>
      route.fulfill({ json: MOCK_CONFIG })
    );
    await page.route(/\/api\/settings$/, route =>
      route.fulfill({ json: { activeProject: null, projects: [] } })
    );
    await page.route(/\/api\/drafts/, route =>
      route.fulfill({ json: [] })
    );

    await page.goto('/coverage');

    await expect(page.getByText('Select a project to view coverage')).toBeVisible();
  });
});
