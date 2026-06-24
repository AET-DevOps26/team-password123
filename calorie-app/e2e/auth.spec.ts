import { test, expect, type Page } from '@playwright/test';
import { installApiFallback, mockAuthError, mockAuthSuccess, mockGoals } from './support/mocks';
import { seedSession } from './support/session';

// The submit button's visible text ("Sign in" / "Create account") can coincide
// with the register-mode switch link; the mode tabs are disambiguated via
// aria-label ("Switch to …"). `.last()` targets the submit (last in DOM order).
function submitButton(page: Page, label: 'Sign in' | 'Create account') {
  return page.getByRole('button', { name: label, exact: true }).last();
}

test.beforeEach(async ({ page }) => {
  await installApiFallback(page);
});

test('empty sign-in submit shows validation errors', async ({ page }) => {
  await page.goto('/');

  await submitButton(page, 'Sign in').click();

  await expect(page.getByText('Enter a valid email')).toBeVisible();
  await expect(page.getByText('At least 8 characters')).toBeVisible();
});

test('register mode asks for a display name', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();

  await submitButton(page, 'Create account').click();
  await expect(page.getByText('Tell us what to call you')).toBeVisible();
});

test('successful sign-in stores the session and opens onboarding', async ({ page }) => {
  await mockAuthSuccess(page, { accessToken: 'token-from-mock' });
  await mockGoals(page);

  await page.goto('/');
  await page.getByPlaceholder('you@email.com').fill('mia@example.com');
  await page.getByPlaceholder('Your password').fill('secret-123');

  const loginRequest = page.waitForRequest('**/api/auth/login');
  await submitButton(page, 'Sign in').click();

  expect((await loginRequest).postDataJSON()).toEqual({
    email: 'mia@example.com',
    password: 'secret-123',
  });
  await expect(page.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('token-from-mock');
});

test('failed sign-in shows the backend error message', async ({ page }) => {
  await mockAuthError(page, 401, 'Invalid email or password');

  await page.goto('/');
  await page.getByPlaceholder('you@email.com').fill('mia@example.com');
  await page.getByPlaceholder('Your password').fill('wrong-password');
  await submitButton(page, 'Sign in').click();

  await expect(page.getByText('Invalid email or password')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('successful registration sends the display name and opens onboarding', async ({ page }) => {
  await mockAuthSuccess(page);
  await mockGoals(page);

  await page.goto('/');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByPlaceholder('e.g. Mia').fill('Mia');
  await page.getByPlaceholder('you@email.com').fill('mia@example.com');
  await page.getByPlaceholder('Create a password (min 8 chars)').fill('secret-123');

  const registerRequest = page.waitForRequest('**/api/auth/register');
  await submitButton(page, 'Create account').click();

  expect((await registerRequest).postDataJSON()).toEqual({
    email: 'mia@example.com',
    password: 'secret-123',
    displayName: 'Mia',
  });
  await expect(page.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible();
});

test('already authenticated user skips the auth screen', async ({ page }) => {
  await seedSession(page, { displayName: 'Mia' });

  await page.goto('/');

  // Sidebar is the <aside> landmark; "Scan a meal" also exists as a home-page CTA.
  await expect(page.getByRole('complementary').getByRole('button', { name: 'Scan a meal' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).not.toBeVisible();
});
