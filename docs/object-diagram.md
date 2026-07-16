# Analysis Object Model

The persisted domain entities, exactly as implemented (JPA `@Entity` classes, one Postgres schema
per service). All IDs are UUIDs. There are **no cross-schema foreign keys** — services reference a
user only by the `userId` UUID from the JWT and communicate over REST.

```mermaid
classDiagram
    namespace AuthService {
        class AppUser {
            +UUID id
            +String email
            +String passwordHash
            +String displayName
            +OffsetDateTime createdAt
            +Integer heightCm
            +BigDecimal weightKg
            +Integer age
            +Sex sex
            +ActivityLevel activityLevel
            +Goal goal
        }
        class Sex {
            <<enumeration>>
            FEMALE
            MALE
            OTHER
        }
        class ActivityLevel {
            <<enumeration>>
            SEDENTARY
            LIGHT
            MODERATE
            ACTIVE
            VERY_ACTIVE
        }
        class Goal {
            <<enumeration>>
            LOSE
            MAINTAIN
            GAIN
        }
    }

    namespace MealsService {
        class MealLog {
            +UUID id
            +UUID userId
            +MealType mealType
            +OffsetDateTime loggedAt
            +SourceType sourceType
            +BigDecimal calories
            +BigDecimal proteinGrams
            +BigDecimal carbsGrams
            +BigDecimal fatGrams
            +BigDecimal fiberGrams
            +String notes
            +String dishName
            +BigDecimal confidence
        }
        class MealItem {
            +UUID id
            +String name
            +BigDecimal quantity
            +String unit
            +BigDecimal calories
            +BigDecimal proteinGrams
            +BigDecimal carbsGrams
            +BigDecimal fatGrams
            +BigDecimal fiberGrams
        }
        class PhotoLog {
            +UUID id
            +UUID userId
            +String originalFilename
            +String storedFilename
            +String contentType
            +PhotoStatus status
            +OffsetDateTime createdAt
            +OffsetDateTime analyzedAt
        }
        class MealType {
            <<enumeration>>
            BREAKFAST
            LUNCH
            DINNER
            SNACK
        }
        class SourceType {
            <<enumeration>>
            MANUAL
            PHOTO_MANUAL
            PHOTO_AI
        }
        class PhotoStatus {
            <<enumeration>>
            AI_NOT_AVAILABLE
            MANUALLY_COMPLETED
            ANALYZED
        }
    }

    namespace AnalyticsService {
        class NutritionGoal {
            +UUID id
            +UUID userId
            +BigDecimal dailyCalories
            +BigDecimal proteinGrams
            +BigDecimal carbsGrams
            +BigDecimal fatGrams
            +BigDecimal fiberGrams
            +OffsetDateTime updatedAt
        }
    }

    MealLog "1" *-- "0..*" MealItem : items
    PhotoLog "0..1" --> "0..1" MealLog : linkedMealLog
    MealLog "0..*" ..> "1" AppUser : userId (REST only, no FK)
    PhotoLog "0..*" ..> "1" AppUser : userId (REST only, no FK)
    NutritionGoal "0..1" ..> "1" AppUser : userId (REST only, no FK)
```

Notes on intentional absences:

- **No `AnalyticsReport` entity** — daily/weekly/range aggregates, streak, and the RAG insight are
  computed on request by analytics-service from meals-service data; only `NutritionGoal` is
  persisted (one row per user, `userId` unique).
- **No `NutritionData` entity** — macros are inlined on `MealLog`/`MealItem` as `BigDecimal` columns.
- **Photo bytes are not in the database** — `PhotoLog` stores metadata; images live on a filesystem
  volume and are served via `GET /api/meals/photo/:id/raw`.
- genai-service persists nothing relational (Weaviate vector store + static `nutrition_db.json`).

## iOS mirror (SwiftData)

| Backend entity | iOS `@Model` |
|----------------|--------------|
| `AppUser` + `NutritionGoal` | `UserProfile` — one local record, synced via `PUT /api/users/me` + `PUT /api/goals` |
| `MealLog` | `FoodLog` — adds `serverId` + `dirty` flag for offline-first sync |
| `MealItem` | `Ingredient` |
| `PhotoLog` | none — `imageData` inlined on `FoodLog` (`.externalStorage`) |
| — | `WaterLog` — iOS-only, never synced (no backend endpoint) |
| — | `MealTombstone` — iOS-only sync bookkeeping: records offline deletions until pushed |

See [`ios-app/README.md`](../ios-app/README.md) for the sync design.

> The original design-phase sketch is preserved as [`OLD_object-diagram.png`](OLD_object-diagram.png)
> to show how the domain model evolved during the project.
