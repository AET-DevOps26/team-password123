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
| `/diary/:date/manual` | Manual Entry | Form-based meal logging with macro fields |
| `/insights` | Insights | Weekly trend charts, goal progress, streak |
| `/profile` | Profile | User info, goals (calories/macros), settings |
| `/onboarding` | Onboarding | Post-registration goal setup |

## Project structure (Feature-Sliced Design)

```
src/
├── app/          Shell, routing, global styles
├── pages/        Route-level compositions
├── features/     User interactions (auth, scan-meal, manual-entry, onboarding)
├── entities/     Domain models + API clients (meal, nutrition, user)
├── widgets/      Composite UI pieces (Sidebar, Tabbar, Toast)
└── shared/       API client, config flags, reusable UI primitives
```

## Local development

```bash
cd calorie-app
npm install
npm run dev       # starts Vite dev server on http://localhost:3000
```

The dev server proxies `/api/*` to the backend services via `nginx.conf`. If the backend isn't running, enable mock mode:

```bash
VITE_MOCK_MODE=true npm run dev
```

Mock mode intercepts all API calls with realistic fixtures — useful for frontend work without a running backend.

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

E2E specs live in `e2e/` and cover all major flows: auth, onboarding, diary, scan meal, insights, profile. All API calls are mocked, so no running backend is needed.

## Build

```bash
npm run build     # TypeScript check + Vite production build
```

Output goes to `dist/`. The `Dockerfile` runs this build and serves it with nginx.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `` (relative) | Backend API base URL. Leave empty to use the nginx proxy. |
| `VITE_MOCK_MODE` | `false` | Enable mock API responses for frontend-only development |
