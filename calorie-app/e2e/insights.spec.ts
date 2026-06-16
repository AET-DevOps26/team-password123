import { test, expect, type Page, type Locator } from '@playwright/test';
import { buildMeal, installApiFallback, mockMealsRange, mockStreak } from './support/mocks';
import { seedSession } from './support/session';

// Frozen so every period cursor, label and navigation limit is deterministic.
// 2026-06-10 is a Wednesday → week Mon 8 … Sun 14 June 2026.
const TODAY = '2026-06-10';

async function openInsights(page: Page) {
  await page.goto('/');
  await page.getByRole('complementary').getByRole('button', { name: 'Insights' }).click();
  await expect(page.getByRole('heading', { name: 'Your trends' })).toBeVisible();
}

// The ‹ / › period chevrons carry no text; scope them through the periodNav
// container (Vite dev keeps the readable CSS-module class name).
function periodNav(page: Page): Locator {
  return page.locator('[class*="periodNav"]');
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${TODAY}T12:00:00`) });
  await installApiFallback(page);
  await seedSession(page);
});

test('switching tabs changes the chart title and period label', async ({ page }) => {
  await mockMealsRange(page, {});
  await mockStreak(page, 3);

  await openInsights(page);

  // Week is the default range.
  await expect(page.getByRole('heading', { name: 'Calories this week' })).toBeVisible();
  await expect(page.getByText('8–14 Jun 2026')).toBeVisible();

  await page.getByRole('button', { name: 'Month' }).click();
  await expect(page.getByRole('heading', { name: 'Weekly breakdown' })).toBeVisible();
  await expect(page.getByText('June 2026')).toBeVisible();

  await page.getByRole('button', { name: 'Year' }).click();
  await expect(page.getByRole('heading', { name: 'Monthly overview' })).toBeVisible();
  await expect(page.getByText('2026', { exact: true })).toBeVisible();
});

test('period navigation respects the forward limit', async ({ page }) => {
  await mockMealsRange(page, {});
  await mockStreak(page, 3);

  await openInsights(page);
  await page.getByRole('button', { name: 'Year' }).click();

  const prev = periodNav(page).getByRole('button').first();
  const next = periodNav(page).getByRole('button').last();

  // Cannot navigate past the current year, but can go back.
  await expect(next).toBeDisabled();
  await expect(prev).toBeEnabled();

  await prev.click();
  await expect(page.getByText('2025', { exact: true })).toBeVisible();
  await expect(next).toBeEnabled();
});

test('drills Year → Month → Week and unwinds with Back', async ({ page }) => {
  // A logged day in May's second week (4–10 May) so that week's bar carries
  // data and becomes drillable — empty days render as non-clickable "no data".
  await mockMealsRange(page, {
    '2026-05-06': [buildMeal({ id: 'may', loggedAt: '2026-05-06T08:00:00', calories: 1900 })],
  });
  await mockStreak(page, 3);

  await openInsights(page);
  await page.getByRole('button', { name: 'Year' }).click();
  await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);

  // Year → click the May bar → Month view of May.
  await page.getByRole('button').filter({ hasText: 'May' }).click();
  await expect(page.getByRole('heading', { name: 'Weekly breakdown' })).toBeVisible();
  await expect(page.getByText('May 2026')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();

  // Month → click a week bar → Week view.
  await page.getByRole('button').filter({ hasText: 'Wk 2' }).click();
  await expect(page.getByRole('heading', { name: 'Calories this week' })).toBeVisible();

  // Back unwinds Week → Month → Year.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Weekly breakdown' })).toBeVisible();
  await expect(page.getByText('May 2026')).toBeVisible();

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Monthly overview' })).toBeVisible();
  await expect(page.getByText('2026', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
});

test('renders KPIs computed from the fetched week data', async ({ page }) => {
  // Three logged days in the current week; goal defaults are 2000 kcal / 130 g protein.
  await mockMealsRange(page, {
    '2026-06-08': [buildMeal({ id: 'd1', loggedAt: '2026-06-08T08:00:00', calories: 1800, proteinGrams: 130 })],
    '2026-06-09': [buildMeal({ id: 'd2', loggedAt: '2026-06-09T08:00:00', calories: 2200, proteinGrams: 120 })],
    '2026-06-10': [buildMeal({ id: 'd3', loggedAt: '2026-06-10T08:00:00', calories: 2000, proteinGrams: 140 })],
  });
  await mockStreak(page, 7);

  // The week range is fetched on mount (from = the week's Monday, not today —
  // HomePage fetches today first, so match the week start explicitly).
  const weekRequest = page.waitForRequest((req) => req.url().includes('from=2026-06-08'));
  await openInsights(page);
  const query = new URL((await weekRequest).url()).searchParams;
  expect(query.get('from')).toBe('2026-06-08');
  expect(query.get('to')).toBe('2026-06-14');

  // Avg of 1800/2200/2000 = 2000 → exactly on goal.
  await expect(page.getByText('0 kcal below goal')).toBeVisible();
  // cal ≤ 2000 on Mon & Wed → 2 of 3 days.
  await expect(page.getByText('2 of 3 days on target')).toBeVisible();

  // Streak KPI comes from /analytics/streak.
  const streakCard = page.locator('[class*="kpiCard"]', { hasText: 'Logging streak' });
  await expect(streakCard).toContainText('7');
  await expect(streakCard).toContainText('Current streak');
});
