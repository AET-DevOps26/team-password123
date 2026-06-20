import type { Page } from '@playwright/test';
import type { MealResponse, ManualMealRequest } from '../../src/entities/meal/api/backendTypes';
import type { MealAnalysisResponse } from '../../src/entities/meal/model/types';

export interface AuthResponseData {
  tokenType: string;
  accessToken: string;
  expiresAt: string;
  userId: string;
  email: string;
  displayName: string;
}

export function buildAuthResponse(overrides: Partial<AuthResponseData> = {}): AuthResponseData {
  return {
    tokenType: 'Bearer',
    accessToken: 'e2e-token',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    userId: '42',
    email: 'mia@example.com',
    displayName: 'Mia',
    ...overrides,
  };
}

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

// Matchers are pathname predicates: a naive '**/api/**' glob would also
// intercept Vite module requests like /src/shared/api/client.ts and break
// the app load entirely.
const isApiRequest = (url: URL) => url.pathname.startsWith('/api/');
const isAuthEndpoint = (url: URL) => /^\/api\/auth\/(login|register)$/.test(url.pathname);
const isGoalsEndpoint = (url: URL) => url.pathname === '/api/goals';
const isMealsEndpoint = (url: URL) => url.pathname === '/api/meals';
const isManualMealEndpoint = (url: URL) => url.pathname === '/api/meals/manual';
const isAnalyzeEndpoint = (url: URL) => url.pathname === '/api/meals/analyze';
const isStreakEndpoint = (url: URL) => url.pathname === '/api/analytics/streak';

// Catch-all for /api/*. Must be installed BEFORE endpoint-specific mocks:
// Playwright matches routes in reverse registration order, so later,
// more specific routes win over this fallback.
export async function installApiFallback(page: Page) {
  await page.route(isApiRequest, (route) => {
    const method = route.request().method();
    const path = new URL(route.request().url()).pathname;
    return route.fulfill(json({ message: `e2e: no mock for ${method} ${path}` }, 404));
  });
}

export async function mockAuthSuccess(page: Page, overrides: Partial<AuthResponseData> = {}): Promise<AuthResponseData> {
  const response = buildAuthResponse(overrides);
  await page.route(isAuthEndpoint, (route) => route.fulfill(json(response)));
  return response;
}

export async function mockAuthError(page: Page, status: number, message: string) {
  await page.route(isAuthEndpoint, (route) => route.fulfill(json({ message }, status)));
}

export function buildMeal(overrides: Partial<MealResponse> = {}): MealResponse {
  return {
    id: 'meal-1',
    mealType: 'LUNCH',
    loggedAt: '2026-06-10T12:00:00',
    sourceType: 'MANUAL',
    calories: 500,
    proteinGrams: 30,
    carbsGrams: 50,
    fatGrams: 20,
    fiberGrams: 0,
    notes: 'Chicken salad',
    items: [],
    ...overrides,
  };
}

// GET /meals?from=DATE&to=DATE → meals keyed by the `from` date
// (the diary always requests a single day, from === to).
export async function mockMeals(page: Page, mealsByDate: Record<string, MealResponse[]>) {
  await page.route(isMealsEndpoint, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const from = new URL(route.request().url()).searchParams.get('from') ?? '';
    return route.fulfill(json(mealsByDate[from] ?? []));
  });
}

// Stateful meals mock mirroring the real backend round-trip:
//   GET  /meals?from=DATE  → the current per-day store
//   POST /meals/manual     → appends a MANUAL meal (totals summed from items)
//                            and echoes it back
// so the diary's post-save refetch surfaces the freshly logged entry.
// Keyed by the date portion of loggedAt; the day clock is frozen to noon in
// the specs, so the local `from` date and the ISO loggedAt date agree.
export async function mockMealsStore(
  page: Page,
  initial: Record<string, MealResponse[]> = {},
) {
  const store: Record<string, MealResponse[]> = {};
  for (const [date, meals] of Object.entries(initial)) store[date] = [...meals];
  let seq = 0;

  await page.route(isMealsEndpoint, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const from = new URL(route.request().url()).searchParams.get('from') ?? '';
    return route.fulfill(json(store[from] ?? []));
  });

  await page.route(isManualMealEndpoint, (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const req = route.request().postDataJSON() as ManualMealRequest;
    const totals = req.items.reduce(
      (acc, it) => ({
        calories: acc.calories + it.calories,
        proteinGrams: acc.proteinGrams + it.proteinGrams,
        carbsGrams: acc.carbsGrams + it.carbsGrams,
        fatGrams: acc.fatGrams + it.fatGrams,
        fiberGrams: acc.fiberGrams + it.fiberGrams,
      }),
      { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0 },
    );
    const meal: MealResponse = {
      id: `srv-${++seq}`,
      mealType: req.mealType,
      loggedAt: req.loggedAt,
      sourceType: 'MANUAL',
      ...totals,
      notes: req.notes,
      items: req.items.map((it, i) => ({ id: `srv-${seq}-i${i}`, ...it })),
    };
    const date = req.loggedAt.slice(0, 10);
    (store[date] ??= []).push(meal);
    return route.fulfill(json(meal, 201));
  });

  return store;
}

export function buildAnalysis(
  meal: Partial<MealAnalysisResponse['meal']> = {},
): MealAnalysisResponse {
  return {
    message: 'ok',
    meal: {
      id: 1,
      userId: 42,
      dishName: 'Grilled salmon',
      imageUrl: '',
      nutrition: { calories: 420, protein: 35, fat: 26, carbs: 12 },
      confidence: 0.87,
      analyzedAt: '2026-06-10T12:00:00',
      ...meal,
    },
  };
}

// POST /meals/analyze — the GenAI vision model recognized the dish.
export async function mockPhotoAnalysis(page: Page, meal: Partial<MealAnalysisResponse['meal']> = {}) {
  const response = buildAnalysis(meal);
  await page.route(isAnalyzeEndpoint, (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill(json(response));
  });
  return response;
}

// POST /meals/analyze fails — the app degrades to the manual-entry stage.
export async function mockPhotoAnalysisError(page: Page, status = 503, message = 'AI service unavailable') {
  await page.route(isAnalyzeEndpoint, (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill(json({ message }, status));
  });
}

// GET /meals?from=X&to=Y over a multi-day range (used by InsightsPage, which
// fetches a whole week/month/year). Returns every meal whose date key falls in
// [from, to] — ISO date strings compare lexicographically, so plain >=/<= works.
export async function mockMealsRange(page: Page, mealsByDate: Record<string, MealResponse[]>) {
  await page.route(isMealsEndpoint, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const params = new URL(route.request().url()).searchParams;
    const from = params.get('from') ?? '';
    const to   = params.get('to') ?? '';
    const result: MealResponse[] = [];
    for (const [date, meals] of Object.entries(mealsByDate)) {
      if (date >= from && date <= to) result.push(...meals);
    }
    return route.fulfill(json(result));
  });
}

// GET /analytics/streak → the logging-streak count.
export async function mockStreak(page: Page, streak: number) {
  await page.route(isStreakEndpoint, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill(json({ streak }));
  });
}

// GET /goals: 204 when the user has no saved goals (the backend contract),
// otherwise a GoalResponse body.
export async function mockGoals(page: Page, goals: unknown = null) {
  await page.route(isGoalsEndpoint, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return goals === null
      ? route.fulfill({ status: 204, body: '' })
      : route.fulfill(json(goals));
  });
}

// PUT /goals — echo the saved goals back as a GoalResponse.
export async function mockSaveGoals(page: Page) {
  await page.route(isGoalsEndpoint, (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    const body = route.request().postDataJSON();
    return route.fulfill(json({ id: 'g1', updatedAt: new Date().toISOString(), ...body }));
  });
}
