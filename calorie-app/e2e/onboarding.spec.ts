import { test, expect, type Page } from '@playwright/test';
import { installApiFallback } from './support/mocks';
import { seedSession } from './support/session';

// Each stepper row is a div wrapping the label and the −/+ buttons.
function stepperRow(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator('..');
}

function nextButton(page: Page) {
  return page.getByRole('button', { name: 'Next' });
}

test.beforeEach(async ({ page }) => {
  await installApiFallback(page);
  await seedSession(page, { onboarded: false, displayName: 'Mia' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible();
});

test('full walkthrough with defaults computes and persists the goals', async ({ page }) => {
  // Step 1: name is prefilled from the session user
  const nameInput = page.getByPlaceholder('Your name');
  await expect(nameInput).toHaveValue('Mia');
  await nameInput.fill('Pavel');
  await nextButton(page).click();

  // Step 2 → 3 with default physical data (female, 30y, 170cm, 70kg)
  await expect(page.getByText('About you')).toBeVisible();
  await nextButton(page).click();

  // Step 3 → 4 with defaults (moderately active, maintain)
  await expect(page.getByText('Activity level')).toBeVisible();
  await nextButton(page).click();

  // Step 4: Mifflin–St Jeor for the defaults
  await expect(page.getByText('Suggested daily goals')).toBeVisible();
  await expect(page.getByText('2250 kcal')).toBeVisible();
  await expect(page.getByText('169 g')).toBeVisible();
  await expect(page.getByText('225 g')).toBeVisible();
  await expect(page.getByText('75 g')).toBeVisible();

  await page.getByRole('button', { name: 'Finish' }).click();

  // Lands in the main shell; the greeting uses the session display name
  await expect(page.getByRole('heading', { name: 'Good afternoon, Mia' })).toBeVisible();

  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('userProfile')!));
  expect(profile.onboardingComplete).toBe(true);
  expect(profile.displayName).toBe('Pavel');
  expect(profile.goals).toEqual({ calories: 2250, protein: 169, carbs: 225, fats: 75, water: 2000 });

  // Onboarding must not reappear after a reload
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Good afternoon, Mia' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome', exact: true })).not.toBeVisible();
});

test('cannot continue without a name', async ({ page }) => {
  await page.getByPlaceholder('Your name').fill('');
  await expect(nextButton(page)).toBeDisabled();

  await page.getByPlaceholder('Your name').fill('Pavel');
  await expect(nextButton(page)).toBeEnabled();
});

test('steppers adjust the physical data', async ({ page }) => {
  await nextButton(page).click();

  await stepperRow(page, 'Age').getByRole('button', { name: '+' }).click();
  await expect(stepperRow(page, 'Age')).toContainText('31');

  await stepperRow(page, 'Height').getByRole('button', { name: '−' }).click();
  await expect(stepperRow(page, 'Height')).toContainText('169 cm');

  // Weight steps by 0.5 and renders one decimal
  await stepperRow(page, 'Weight').getByRole('button', { name: '+' }).click();
  await expect(stepperRow(page, 'Weight')).toContainText('70.5 kg');
});

test('sex and goal choices change the computed goals', async ({ page }) => {
  await nextButton(page).click();

  await page.getByRole('combobox').selectOption('male');
  await nextButton(page).click();

  await page.getByRole('button', { name: 'Lose weight' }).click();
  await nextButton(page).click();

  // male, 30y, 170cm, 70kg, moderate, −500 kcal for losing weight
  await expect(page.getByText('2007 kcal')).toBeVisible();
  await expect(page.getByText('151 g')).toBeVisible();
  await expect(page.getByText('201 g')).toBeVisible();
  await expect(page.getByText('67 g')).toBeVisible();
});

test('going back preserves the entered data', async ({ page }) => {
  await page.getByPlaceholder('Your name').fill('Pavel');
  await nextButton(page).click();

  await stepperRow(page, 'Age').getByRole('button', { name: '+' }).click();
  await expect(stepperRow(page, 'Age')).toContainText('31');

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByPlaceholder('Your name')).toHaveValue('Pavel');

  await nextButton(page).click();
  await expect(stepperRow(page, 'Age')).toContainText('31');
});
