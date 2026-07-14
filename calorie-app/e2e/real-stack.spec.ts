import { test, expect } from '@playwright/test';

// Real-stack smoke test (audit issue #29): exercises the LIVE backend through
// the Vite dev-server proxy — register → onboarding → manual meal → diary —
// with NO route mocks. Requires postgres + auth-service (:8081) and
// meals-service (:8082) from docker-compose. analytics-service (:8083) may be
// DOWN: every call to it (goals save/load, streak, weekly analytics) is
// non-blocking in the app, so its absence must not fail this flow.
//
// Guarded so the default (mocked) suite reports it as skipped, never failed.
test.skip(
  !process.env.E2E_REAL_STACK,
  'real-stack smoke: set E2E_REAL_STACK=1 with the compose backend (postgres, auth-service, meals-service) running',
);

// Real HTTP round trips + first dev-server compile need headroom over the 30s default.
test.setTimeout(120_000);

test('register → onboarding → manual meal → diary against the real backend', async ({ page }) => {
  // Unique per run so re-runs never collide with an already-registered email.
  const email = `e2e-${Date.now()}@example.com`;

  // ── Register a fresh account (real POST /api/auth/register) ──
  await page.goto('/');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();

  await page.getByPlaceholder('e.g. Mia').fill('Smokey');
  await page.getByPlaceholder('you@email.com').fill(email);
  await page.getByPlaceholder('Create a password (min 8 chars)').fill('sm0ke-test-pass');
  // The visible text can coincide with the mode-switch link; the submit is
  // last in DOM order (same disambiguation as auth.spec.ts).
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click();

  // A fresh user has no profile on the backend (me().age == null), so the app
  // gates them into the onboarding wizard before the diary is reachable.
  await expect(page.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible();

  // ── Walk the onboarding wizard with the defaults ──
  // Step 1: name is prefilled from the registration display name.
  await expect(page.getByPlaceholder('Your name')).toHaveValue('Smokey');
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 2 → 3 with the default physical data (female, 30y, 170cm, 70kg).
  await expect(page.getByText('About you')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 3 → 4 with the defaults (moderately active, maintain).
  await expect(page.getByText('Activity level')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 4: Mifflin–St Jeor for the defaults. Finish persists the profile to
  // auth-service; the goals save targets analytics-service and is non-blocking
  // (OnboardingFlow catches the error), so it must not be required here.
  await expect(page.getByText('Suggested daily goals')).toBeVisible();
  await expect(page.getByText('2250 kcal')).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();

  // Lands in the main shell with the time-of-day greeting.
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening), Smokey$/ }),
  ).toBeVisible();

  // ── Log a manual meal (real POST /api/meals/manual) ──
  // Sidebar is the <aside> landmark, same as the mocked specs.
  await page.getByRole('complementary').getByRole('button', { name: 'Diary' }).click();
  // Fresh user, empty day, against the 2250 kcal goal onboarding just computed.
  await expect(page.getByText('0 / 2,250 kcal')).toBeVisible();

  await page.getByRole('button', { name: 'Add breakfast' }).click();
  await expect(page.getByText('Add ingredients')).toBeVisible();

  // The suggestion list is a static client-side food DB — no GenAI involved.
  await page.getByPlaceholder('Search a food or brand…').fill('Banana');
  await page.getByRole('button', { name: /Banana/ }).click();
  await expect(page.getByText('Your ingredients')).toBeVisible();

  await page.getByRole('button', { name: 'Save to diary' }).click();

  // ── The diary refetch surfaces the entry persisted by meals-service ──
  await expect(page.getByText('Logged 105 kcal to your diary')).toBeVisible();
  await expect(page.getByText('Banana')).toBeVisible();
  await expect(page.getByText('105 / 2,250 kcal')).toBeVisible();
});
