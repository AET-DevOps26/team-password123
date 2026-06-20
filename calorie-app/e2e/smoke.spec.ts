import { test, expect } from '@playwright/test';

test('app loads and shows the sign-in screen', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByPlaceholder('you@email.com')).toBeVisible();
  await expect(page.getByPlaceholder('Your password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
});
