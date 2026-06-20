import { test, expect, type Page } from '@playwright/test';
import { installApiFallback, mockMealsStore } from './support/mocks';
import { seedSession } from './support/session';

// Frozen to noon so the diary's local `from` date and the ISO loggedAt the
// modal sends line up on the same calendar day.
const TODAY = '2026-06-10'; // Wednesday

async function openDiary(page: Page) {
  await page.goto('/');
  await page.getByRole('complementary').getByRole('button', { name: 'Diary' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${TODAY}T12:00:00`) });
  await installApiFallback(page);
  await seedSession(page);
});

test('logs a manual meal from a slot and shows it after the diary refetches', async ({ page }) => {
  await mockMealsStore(page, { [TODAY]: [] });

  await openDiary(page);
  await expect(page.getByText('0 / 2,000 kcal')).toBeVisible();

  // Open the modal scoped to the Breakfast slot (its empty-slot add button).
  await page.getByRole('button', { name: 'Add breakfast' }).click();
  await expect(page.getByText('Add ingredients')).toBeVisible();

  // Search filters the suggestion list; picking one adds it and clears the query.
  await page.getByPlaceholder('Search a food or brand…').fill('Banana');
  await page.getByRole('button', { name: /Banana/ }).click();
  await expect(page.getByText('Your ingredients')).toBeVisible();

  // Save and assert the POST payload reflects the chosen slot + ingredient.
  const saveRequest = page.waitForRequest(
    (req) => req.url().includes('/api/meals/manual') && req.method() === 'POST',
  );
  await page.getByRole('button', { name: 'Save to diary' }).click();

  const body = (await saveRequest).postDataJSON();
  expect(body.mealType).toBe('BREAKFAST');
  expect(body.notes).toBe('Banana');
  expect(body.items).toHaveLength(1);
  expect(body.items[0]).toMatchObject({ name: 'Banana', calories: 105 });
  expect(body.loggedAt.slice(0, 10)).toBe(TODAY);

  // Toast confirms, and the post-save refetch surfaces the new entry + total.
  await expect(page.getByText('Logged 105 kcal to your diary')).toBeVisible();
  await expect(page.getByText('Banana')).toBeVisible();
  await expect(page.getByText('105 / 2,000 kcal')).toBeVisible();
});
