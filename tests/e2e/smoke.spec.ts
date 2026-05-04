import { test, expect } from '@playwright/test';

// Stub the API so the SPA renders without a real backend in CI/local.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/clubs', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(['Mitre CC', 'Test Club']),
    }),
  );
});

test('homepage shows the club list', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('British Cycling Club Viewer')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mitre CC' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Test Club' })).toBeVisible();
});

test('about page renders', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { name: /About British Cycling Club Viewer/i })).toBeVisible();
});
