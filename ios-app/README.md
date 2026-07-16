# Nutrition iOS App

SwiftUI + SwiftData client for the nutrition/health-tracking app, wired to the same
Spring Boot microservices + GenAI service as the web client. SwiftData is kept as an
**offline cache**: views read it via `@Query`, mutations go through `SyncService`,
which writes locally (optimistic) and pushes/pulls the backend.

## Status

- Email/password **auth** (`Session` + Keychain JWT), login/register gate before the app
- **Backend sync** of meals, profile, and goals via `auth` / `meals` / `analytics` services
- **GenAI photo analysis** — "Analyze with AI" in the meal editor calls `POST /api/meals/analyze`
- Manual meal logging with calories + macros
- Daily progress vs goals, weekly analytics (Swift Charts), logging streak
- Profile / goal editing (synced); water logging stays local (no backend endpoint)
- Offline-first: works without network, queues changes, reconciles on next `sync()`
- Home screen widget via WidgetKit

### Networking layer
- `Networking/Backend.swift` — `AppConfig`, `KeychainStore`, `APIClient` (async/await)
- `Networking/DTOs.swift` — Codable mirrors of the Spring DTOs + typed endpoints
- `Auth/Session.swift` — observable auth state
- `Sync/SyncService.swift` — DTO↔SwiftData mappers, pull/push, offline queue

Point at a different backend with the `API_BASE_URL` env var (default: the AET ingress).
Run with `--offline` for a no-network guest session.

## Requirements

- Xcode 16.0+
- iOS 17.0+ (SwiftData)
- Swift 5.9+
- [xcodegen](https://github.com/yonaskolb/XcodeGen) — optional; see the warning under "Opening in Xcode"

## Opening in Xcode

```bash
cd ios-app
open NutritionApp.xcodeproj   # committed project — already includes the NutritionAppTests target
# select the NutritionApp scheme + an iOS 17+ simulator, then Cmd-R
```

> ⚠️ The committed `NutritionApp.xcodeproj` is the source of truth: it carries the
> `NutritionAppTests` target that CI runs. `xcodegen generate` rebuilds the project
> from `project.yml`, which does **not** define that target, so regenerating drops
> the tests. Only run it if you re-add the test target afterwards.

Optional scheme launch arguments: `--seed-sample-data` (7 days of meals/water), `--skip-onboarding`, `--offline`.

## Tests

`NutritionAppTests/` (part of the committed `NutritionApp.xcodeproj`) holds fast
unit tests — `GoalCalculatorTests`, `StreakCalculatorTests`, `FoodLogTests`,
`SyncMappingTests`, `CSVExporterTests`, `WidgetSnapshotTests` — plus
`LiveIntegrationTests`, which drives the app's real `APIClient` + `SyncService`
against the live AET backend (register → goals → meal round-trip, `SyncService`
cache pull, GenAI photo analyze).

CI runs the whole target on every `ios-app/**` PR via
[`.github/workflows/ios.yml`](../.github/workflows/ios.yml). Locally:

```bash
# unit tests only (no backend needed):
xcodebuild test -project NutritionApp.xcodeproj -scheme NutritionApp \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -skip-testing:NutritionAppTests/LiveIntegrationTests
# drop -skip-testing to also run the live-backend tests
```

> The `-destination` device is an example — use any installed iOS 17+ simulator
> (CI uses `iPhone 16` on Xcode 16; local dev on Xcode 26 uses `iPhone 17`).
>
> `LiveIntegrationTests` needs the AET backend reachable and registers throwaway
> users on it; `test_03` also depends on the deployed GenAI vision key, so a red
> there can mean a backend-config issue, not an app bug.

## Domain model (vs `docs/object-diagram.md`)

| Backend entity | iOS `@Model` |
|----------------|--------------|
| `AppUser` (auth) + `NutritionGoal` (analytics) | `UserProfile` — one local record, synced via `PUT /api/users/me` + `PUT /api/goals`; JWT in Keychain |
| `MealLog` | `FoodLog` — adds `serverId` + `dirty` flag for offline-first sync |
| `MealItem` | `Ingredient` |
| `PhotoLog` | none — `imageData` inlined on `FoodLog` (`.externalStorage`) |
| — | `WaterLog` — iOS-only, never synced (no backend endpoint) |

Analytics stay compute-on-read here too: `AnalyticsView` derives charts from synced data via
`@Query`, matching the backend, which persists no aggregates.

## Known gaps

- Water tracking is local-only (no backend endpoint)
- Health-insight RAG card exists on web but not yet on iOS
