import { test, expect, type Page } from '@playwright/test';
import {
  installApiFallback,
  mockMealsStore,
  mockPhotoAnalysis,
  mockPhotoAnalysisError,
} from './support/mocks';
import { seedSession } from './support/session';

// A 1×1 PNG — the modal only checks the MIME type and size, not the pixels.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function photo(name: string) {
  return { name, mimeType: 'image/png', buffer: PNG_1x1 };
}

async function openScan(page: Page) {
  await page.goto('/');
  await page.getByRole('complementary').getByRole('button', { name: 'Scan a meal' }).click();
  await expect(page.getByText('JPG, PNG, WEBP — up to 10 MB')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await installApiFallback(page);
  await seedSession(page);
});

test('AI recognises the dish and logs the result to the diary', async ({ page }) => {
  await mockPhotoAnalysis(page, { dishName: 'Grilled salmon', confidence: 0.87 });

  await openScan(page);

  // Analyze stays disabled until a photo is chosen.
  const analyze = page.getByRole('button', { name: 'Analyze meal' });
  await expect(analyze).toBeDisabled();
  await page.locator('input[type="file"]').setInputFiles(photo('salmon.png'));
  await expect(analyze).toBeEnabled();

  const analyzeRequest = page.waitForRequest(
    (req) => req.url().includes('/api/meals/analyze') && req.method() === 'POST',
  );
  await analyze.click();
  await analyzeRequest;

  // Result stage: dish name, confidence badge, kcal and macro bars.
  await expect(page.getByText('Grilled salmon')).toBeVisible();
  await expect(page.getByText('87% match')).toBeVisible();
  await expect(page.getByText('420', { exact: true })).toBeVisible();
  await expect(page.getByText('35', { exact: true })).toBeVisible(); // protein macro bar

  await page.getByRole('button', { name: 'Add 420 kcal to diary' }).click();
  await expect(page.getByText('Logged 420 kcal to your diary')).toBeVisible();
});

test('falls back to manual entry when the AI is unavailable and saves it', async ({ page }) => {
  await mockPhotoAnalysisError(page, 503);
  const store = await mockMealsStore(page, {});

  await openScan(page);

  // The filename seeds the dish-name field (dashes → spaces, extension dropped).
  await page.locator('input[type="file"]').setInputFiles(photo('chicken-pasta.png'));
  await page.getByRole('button', { name: 'Analyze meal' }).click();

  await expect(page.getByText('Fill in details')).toBeVisible();
  await expect(page.getByPlaceholder('e.g. Chicken pasta')).toHaveValue('chicken pasta');

  // Log button is disabled until calories are entered.
  await expect(page.getByRole('button', { name: 'Log 0 kcal' })).toBeDisabled();
  await page.getByPlaceholder('e.g. 520').fill('520');

  const saveRequest = page.waitForRequest(
    (req) => req.url().includes('/api/meals/manual') && req.method() === 'POST',
  );
  await page.getByRole('button', { name: 'Log 520 kcal' }).click();

  const body = (await saveRequest).postDataJSON();
  expect(body.mealType).toBe('LUNCH'); // default slot
  expect(body.notes).toBe('chicken pasta');
  expect(body.items).toHaveLength(1);
  expect(body.items[0]).toMatchObject({ name: 'chicken pasta', calories: 520 });

  await expect(page.getByText('Logged 520 kcal to your diary')).toBeVisible();
  // The stateful mock recorded the saved meal.
  expect(Object.values(store).flat()).toHaveLength(1);
});
