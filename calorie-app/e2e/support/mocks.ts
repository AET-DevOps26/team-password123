import type { Page } from '@playwright/test';

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
