import { test, expect, type Page } from '@playwright/test';
import { buildMeal, installApiFallback, mockMeals } from './support/mocks';
import { seedSession } from './support/session';

// The diary computes everything from the real "today", so the clock is
// frozen to keep date labels and request params deterministic.
const TODAY = '2026-06-10'; // Wednesday
const YESTERDAY = '2026-06-09';

const TODAY_MEALS = [
  buildMeal({
    id: 'm1',
    mealType: 'BREAKFAST',
    notes: 'Oatmeal with berries',
    loggedAt: `${TODAY}T08:30:00`,
    calories: 320,
    proteinGrams: 20,
    carbsGrams: 40,
    fatGrams: 8,
  }),
  buildMeal({
    id: 'm2',
    mealType: 'LUNCH',
    notes: 'Chicken salad',
    loggedAt: `${TODAY}T13:00:00`,
    calories: 500,
    proteinGrams: 30,
    carbsGrams: 50,
    fatGrams: 20,
  }),
];

async function openDiary(page: Page) {
  await page.goto('/');
  await page.getByRole('complementary').getByRole('button', { name: 'Diary' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${TODAY}T12:00:00`) });
  await installApiFallback(page);
  await seedSession(page);
});

test('shows the day meals grouped by slot with totals and the goal', async ({ page }) => {
  await mockMeals(page, { [TODAY]: TODAY_MEALS });

  const mealsRequest = page.waitForRequest((req) => req.url().includes('/api/meals'));
  await openDiary(page);

  const query = new URL((await mealsRequest).url()).searchParams;
  expect(query.get('from')).toBe(TODAY);
  expect(query.get('to')).toBe(TODAY);

  await expect(page.getByRole('heading', { name: 'Today, Wed 10 June' })).toBeVisible();
  await expect(page.getByText('Oatmeal with berries')).toBeVisible();
  await expect(page.getByText('Chicken salad')).toBeVisible();

  // Day total = 320 + 500 against the default 2000 kcal goal from the profile
  await expect(page.getByText('820 / 2,000 kcal')).toBeVisible();
  await expect(page.getByText('50 g')).toBeVisible();  // protein chip
  await expect(page.getByText('90 g')).toBeVisible();  // carbs chip
  await expect(page.getByText('28 g')).toBeVisible();  // fat chip

  // Per-slot subtotals
  await expect(page.getByText('320 kcal')).toBeVisible();
  await expect(page.getByText('500 kcal')).toBeVisible();
});

test('empty day shows zero total and add buttons for every slot', async ({ page }) => {
  await mockMeals(page, {});

  await openDiary(page);

  await expect(page.getByText('0 / 2,000 kcal')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add breakfast' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add lunch' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add dinner' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add snack' })).toBeVisible();
  // Empty slot subtotals render as a dash
  await expect(page.getByText('—')).toHaveCount(4);
});

test('navigates to the previous day and back', async ({ page }) => {
  await mockMeals(page, {
    [TODAY]: TODAY_MEALS,
    [YESTERDAY]: [
      buildMeal({
        id: 'm3',
        mealType: 'DINNER',
        notes: 'Pasta bolognese',
        loggedAt: `${YESTERDAY}T19:00:00`,
        calories: 650,
      }),
    ],
  });

  await openDiary(page);
  const nextDay = page.getByRole('button', { name: 'Next day' });
  await expect(nextDay).toBeDisabled();

  const yesterdayRequest = page.waitForRequest((req) => req.url().includes(`from=${YESTERDAY}`));
  await page.getByRole('button', { name: 'Previous day' }).click();
  await yesterdayRequest;

  await expect(page.getByRole('heading', { name: 'Tuesday 9 June' })).toBeVisible();
  await expect(page.getByText('Pasta bolognese')).toBeVisible();
  await expect(page.getByText('650 / 2,000 kcal')).toBeVisible();

  await expect(nextDay).toBeEnabled();
  await nextDay.click();

  await expect(page.getByRole('heading', { name: 'Today, Wed 10 June' })).toBeVisible();
  await expect(page.getByText('Chicken salad')).toBeVisible();
  await expect(nextDay).toBeDisabled();
});

test('week strip disables future days and jumps to a past day', async ({ page }) => {
  await mockMeals(page, { [TODAY]: TODAY_MEALS });

  await openDiary(page);

  // Week of Wed 10 June: Mon 8 … Sun 14; days after today are disabled
  await expect(page.getByRole('button', { name: 'T 11' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'F 12' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'S 13' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'S 14' })).toBeDisabled();

  await page.getByRole('button', { name: 'M 8' }).click();
  await expect(page.getByRole('heading', { name: 'Monday 8 June' })).toBeVisible();
});
