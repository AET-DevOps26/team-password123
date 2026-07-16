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

- Xcode 15.0+
- iOS 17.0+ (SwiftData)
- Swift 5.9+
- [xcodegen](https://github.com/yonaskolb/XcodeGen) (to generate the Xcode project)

## Opening in Xcode

```bash
cd ios-app
xcodegen generate
open NutritionApp.xcodeproj
# select the NutritionApp scheme + an iOS 17 simulator, then Cmd-R
```

Optional scheme launch arguments: `--seed-sample-data` (7 days of meals/water), `--skip-onboarding`, `--offline`.

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

- No UI test target. Unit tests + live-backend integration tests live in `NutritionAppTests`
  (part of the committed `NutritionApp.xcodeproj` — regenerating with xcodegen drops the test target):

  ```bash
  xcodebuild test -project NutritionApp.xcodeproj -scheme NutritionApp \
    -destination 'platform=iOS Simulator,name=iPhone 17' \
    -skip-testing:NutritionAppTests/LiveIntegrationTests   # omit to also hit the live backend
  ```
- Water tracking is local-only (no backend endpoint)
- Health-insight RAG card exists on web but not yet on iOS
