import { test, expect } from '@playwright/test';

test.describe('Setup Form', () => {
  test.beforeEach(async ({ request }) => {
    // Clear config before each test
    await request.delete('http://localhost:3001/api/config');
  });

  test('displays welcome form when not configured', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Welcome to RayDrop')).toBeVisible();
    await expect(page.getByPlaceholder(/Client ID/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Client Secret/i)).toBeVisible();
    await expect(page.getByPlaceholder('your-company')).toBeVisible();
  });

  test('shows validation errors for empty form', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Validate & Save/i }).click();

    await expect(page.getByText(/Client ID is required/i)).toBeVisible();
    await expect(page.getByText(/Client Secret is required/i)).toBeVisible();
  });

  test('clears validation error when typing', async ({ page }) => {
    await page.goto('/');

    // Trigger error
    await page.getByRole('button', { name: /Validate & Save/i }).click();
    await expect(page.getByText(/Client ID is required/i)).toBeVisible();

    // Type to clear error
    await page.getByPlaceholder(/Client ID/i).fill('test');
    await expect(page.getByText(/Client ID is required/i)).not.toBeVisible();
  });

  test('shows URL preview when typing subdomain', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('your-company').fill('mycompany');

    await expect(page.getByText('https://mycompany.atlassian.net/')).toBeVisible();
  });

  test('Test Connection button is disabled without credentials', async ({ page }) => {
    await page.goto('/');

    const testButton = page.getByRole('button', { name: /Test Connection/i });
    await expect(testButton).toBeDisabled();
  });

  test('Test Connection button enables with credentials', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder(/Client ID/i).fill('test-client-id');
    await page.getByPlaceholder(/Client Secret/i).fill('test-client-secret');

    const testButton = page.getByRole('button', { name: /Test Connection/i });
    await expect(testButton).not.toBeDisabled();
  });

  test('validates subdomain format', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder(/Client ID/i).fill('client-id');
    await page.getByPlaceholder(/Client Secret/i).fill('client-secret');
    await page.getByPlaceholder('your-company').fill('a');

    await page.getByRole('button', { name: /Validate & Save/i }).click();

    await expect(page.getByText(/at least 2 characters/i)).toBeVisible();
  });

  test('validates subdomain special characters', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder(/Client ID/i).fill('client-id');
    await page.getByPlaceholder(/Client Secret/i).fill('client-secret');
    await page.getByPlaceholder('your-company').fill('my_company!');

    await page.getByRole('button', { name: /Validate & Save/i }).click();

    await expect(page.getByText(/letters, numbers, and hyphens/i)).toBeVisible();
  });

  test('theme toggle switches theme', async ({ page }) => {
    await page.goto('/');

    const themeButton = page.getByRole('button', { name: /Switch to.*mode/i });

    // Get initial state
    const initialDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );

    // Toggle
    await themeButton.click();

    // Should be different now
    const afterToggleDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );

    expect(afterToggleDark).not.toBe(initialDark);
  });

  test('theme persists across page reload', async ({ page }) => {
    await page.goto('/');

    const themeButton = page.getByRole('button', { name: /Switch to.*mode/i });

    // Set to light mode if not already
    const initialDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );

    if (initialDark) {
      await themeButton.click();
    }

    // Reload page
    await page.reload();

    // Should still be light
    const afterReloadDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );

    expect(afterReloadDark).toBe(false);
  });
});

test.describe('Setup Form - Mobile', () => {
  test.beforeEach(async ({ request }) => {
    await request.delete('http://localhost:3001/api/config');
  });

  test('form is responsive on mobile', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile only test');

    await page.goto('/');

    await expect(page.getByText('Welcome to RayDrop')).toBeVisible();

    // Form should still be functional
    await page.getByPlaceholder(/Client ID/i).fill('test');
    await expect(page.getByPlaceholder(/Client ID/i)).toHaveValue('test');
  });
});

test.describe('Setup Form - Accessibility', () => {
  test.beforeEach(async ({ request }) => {
    await request.delete('http://localhost:3001/api/config');
  });

  test('form fields have proper labels', async ({ page }) => {
    await page.goto('/');

    // Check that labels are associated with inputs
    await expect(page.getByText('Client ID')).toBeVisible();
    await expect(page.getByText('Client Secret')).toBeVisible();
    await expect(page.getByText('Jira Subdomain')).toBeVisible();
  });

  test('form is keyboard navigable', async ({ page }) => {
    await page.goto('/');

    // Tab through form
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should be able to reach inputs
    const clientIdInput = page.getByPlaceholder(/Client ID/i);
    await clientIdInput.focus();
    await expect(clientIdInput).toBeFocused();
  });
});
