import { test, expect, type Page, type Locator } from '@playwright/test';
import { installApiFallback, mockSaveGoals } from './support/mocks';
import { seedSession } from './support/session';

async function openProfile(page: Page) {
  await page.goto('/');
  await page.getByRole('complementary').getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
}

// Each goal lives in its own stepper row with a − / + pair; scope by the row's
// label (Vite dev keeps the readable CSS-module class name).
function goalRow(page: Page, label: string): Locator {
  return page.locator('[class*="stepperRow"]', { hasText: label });
}

test.beforeEach(async ({ page }) => {
  await installApiFallback(page);
  await seedSession(page);
});

test('steppers adjust the goal values', async ({ page }) => {
  await openProfile(page);

  const calories = goalRow(page, 'Calories');
  await expect(calories).toContainText('2,000 kcal'); // default goal
  await calories.getByRole('button', { name: '+' }).click();
  await expect(calories).toContainText('2,050 kcal');

  const protein = goalRow(page, 'Protein');
  await expect(protein).toContainText('130 g');
  await protein.getByRole('button', { name: '−' }).click();
  await expect(protein).toContainText('125 g');
});

test('saves the goals to the backend and confirms', async ({ page }) => {
  await mockSaveGoals(page);

  await openProfile(page);

  // Bump calories so the saved payload is observably different from the default.
  await goalRow(page, 'Calories').getByRole('button', { name: '+' }).click();

  const saveRequest = page.waitForRequest(
    (req) => req.url().endsWith('/api/goals') && req.method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Save goals' }).click();

  const body = (await saveRequest).postDataJSON();
  expect(body).toMatchObject({
    dailyCalories: 2050,
    proteinGrams: 130,
    carbsGrams: 250,
    fatGrams: 70,
    fiberGrams: 0,
  });

  await expect(page.getByRole('button', { name: 'Saved ✓' })).toBeVisible();
});

test('sign out returns to the auth screen', async ({ page }) => {
  await openProfile(page);

  // Both the sidebar and the page have a "Sign out"; use the page's.
  await page.getByRole('main').getByRole('button', { name: 'Sign out' }).click();

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByPlaceholder('you@email.com')).toBeVisible();
});
