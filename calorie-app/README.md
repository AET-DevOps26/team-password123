# Calorieasy Web Client

React + TypeScript frontend for the nutrition tracking platform.

- **Port**: 3000 (dev), 80 (production nginx)
- **Framework**: Vite + React 18 + TypeScript 5
- **Architecture**: Feature-Sliced Design (FSD)
- **State management**: Zustand
- **Testing**: Vitest (unit) + Playwright (e2e)

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Daily calorie ring, quick-log shortcuts, streak |
| `/diary` | Diary | Daily meal log, add/edit entries, date navigation |
| `/diary/:date/scan` | Scan Meal | Photo upload → GenAI analysis → log |
| `/diary/:date/manual` | Manual Entry | Form-based meal logging with macro fields + AI food estimate |
| `/insights` | Insights | Week/month/year trends, goal progress, streak, RAG health insight |
| `/profile` | Profile | User info, goals (calories/macros), settings |
| `/onboarding` | Onboarding | Post-registration goal setup |

## Project structure (Feature-Sliced Design)

```
src/
├── app/          Shell, routing, global styles
├── pages/        Route-level compositions
├── features/     User interactions (auth, scan-meal, manual-entry, onboarding, health-insight)
├── entities/     Domain models + API clients (meal, nutrition, user)
├── widgets/      Composite UI pieces (Sidebar, Tabbar, Toast)
└── shared/       API client, lib helpers, reusable UI primitives
```

## Local development

```bash
cd calorie-app
npm install
npm run dev       # starts Vite dev server on http://localhost:3000
```

The dev server proxies `/api/*` to the backend services via `vite.config.ts`. Start the backend with `docker compose up` from the repo root (see root README).

For frontend-only work, use the Playwright e2e suite (mocks all API calls) or run against the seeded demo stack (`node scripts/seed.mjs` after compose).

## Running tests

```bash
# Unit tests (Vitest)
npm test

# Unit tests in watch mode
npm run test:watch

# E2E tests (Playwright, Chromium)
npm run test:e2e

# E2E tests with UI
npx playwright test --ui
```

E2e specs live in `e2e/` and cover all major flows: auth, onboarding, diary, scan meal, insights, profile. All API calls are mocked, so no running backend is needed.

## Build

```bash
npm run build     # TypeScript check + Vite production build
```

Output goes to `dist/`. The `Dockerfile` runs this build and serves it with nginx.

## Environment variables

See [`calorie-app/.env.example`](.env.example). The Vite dev proxy reads per-service URLs:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_AUTH_API_URL` | `http://localhost:8081` | Auth service target for dev proxy |
| `VITE_MEALS_API_URL` | `http://localhost:8082` | Meals service target for dev proxy |
| `VITE_ANALYTICS_API_URL` | `http://localhost:8083` | Analytics service target for dev proxy |
