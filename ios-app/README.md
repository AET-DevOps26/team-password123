# Nutrition iOS App

SwiftUI + SwiftData prototype of the nutrition/health-tracking client. Local-only for now: no backend, no GenAI. The data model is shaped so the API layer can be added later without a rewrite.

## Status

- Local SwiftData persistence for `UserProfile` and `FoodLog`
- Manual meal logging with calories + macros
- Photo log entries (image stored locally; macros entered manually until GenAI is wired up)
- Daily progress vs goals
- Weekly analytics (Swift Charts)
- Profile / goal editing

Deferred to a later phase: auth, REST calls to the Spring Boot API, Python GenAI integration.

## Requirements

- Xcode 15.0+
- iOS 17.0+ (SwiftData)
- Swift 5.9+

## Opening in Xcode

This folder contains the Swift sources but no `.xcodeproj` (pbxproj files don't round-trip cleanly through hand editing). To get the app running:

1. Open Xcode → **File → New → Project → iOS App**
2. Product Name: `NutritionApp`, Interface: SwiftUI, Storage: SwiftData (or None — we set up our own container), Language: Swift
3. Save the new project **inside `ios-app/`** so that the generated `NutritionApp/` folder either replaces or sits next to the one in this repo
4. Delete Xcode's stub `ContentView.swift` and `Item.swift`
5. Drag the contents of `NutritionApp/` (Models, Views, Components, `NutritionAppApp.swift`) into the Xcode project navigator with **"Create groups"** selected
6. Build and run on the iOS simulator

## Domain model (vs `docs/object-diagram.png`)

| Doc class         | Implementation                                                              |
|-------------------|-----------------------------------------------------------------------------|
| `User`            | `UserProfile` — single local row, no auth in this phase                     |
| `FoodLog`         | `FoodLog` — id, timestamp, name, notes, isManual, imageData                 |
| `NutritionData`   | **Inlined** onto `FoodLog` (calories, protein, carbs, fats, confidenceScore) |
| `AnalyticsReport` | Computed in `AnalyticsView` from `@Query` results, not persisted            |

The `NutritionData` 1:1 relationship from the class diagram is collapsed into `FoodLog` — SwiftData makes one-to-one relationships verbose with no real upside here, and analytics queries get cleaner.

## Next steps (when API arrives)

- Add a network layer (`AuthClient`, `MealsClient`, `AnalyticsClient`) targeting the Spring Boot endpoints listed in `api-service/README.md`
- Replace SwiftData reads with API-backed views; keep SwiftData as an offline cache
- Wire `POST /api/meals/photo` from `PhotoEntryForm` and consume the GenAI-derived nutrition response (the `confidenceScore` field already has a place to live)
