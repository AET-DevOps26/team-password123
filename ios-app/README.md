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

## Domain model (vs `docs/object-diagram.png`)

| Doc class         | Implementation                                                              |
|-------------------|-----------------------------------------------------------------------------|
| `User`            | `UserProfile` — synced from auth-service; JWT in Keychain                   |
| `FoodLog`         | `FoodLog` — id, timestamp, name, notes, isManual, imageData                 |
| `NutritionData`   | **Inlined** onto `FoodLog` (calories, protein, carbs, fats, confidenceScore) |
| `AnalyticsReport` | Computed in `AnalyticsView` from synced data + `@Query`, not persisted      |

The `NutritionData` 1:1 relationship from the class diagram is collapsed into `FoodLog` — SwiftData makes one-to-one relationships verbose with no real upside here, and analytics queries get cleaner.

## Known gaps

- No unit/UI test target in the xcodegen project
- Water tracking is local-only (no backend endpoint)
- Health-insight RAG card exists on web but not yet on iOS
