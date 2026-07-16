# Use Case Diagram

Calorieasy's user-facing functionality, as implemented in the web client (`calorie-app/`) and the
iOS app (`ios-app/`). Every use case below maps to shipped code — see the table under the diagram.

```mermaid
flowchart LR
    User((User))

    subgraph Calorieasy["Calorieasy — web + iOS"]
        UC1(["Register / Log in"])
        UC2(["Complete onboarding<br/>(TDEE goal calculation)"])
        UC3(["Scan meal photo"])
        UC3a(["Recognize dish + macros<br/>with vision LLM"])
        UC3b(["Enter nutrition manually<br/>when AI is unavailable"])
        UC4(["Log meal manually"])
        UC4a(["Estimate nutrition<br/>from food name"])
        UC5(["Browse food diary<br/>(day navigation)"])
        UC6(["Edit / delete meal"])
        UC7(["View analytics dashboard<br/>(week / month / year, streak)"])
        UC8(["View RAG health insight"])
        UC9(["Manage profile & daily goals"])
        UC10(["Track water intake"])
        UC11(["Set daily reminders"])
        UC12(["Export logs as CSV"])
    end

    LLM["LLM provider<br/>(cloud or local,<br/>OpenAI-compatible)"]

    User --- UC1
    User --- UC2
    User --- UC3
    User --- UC4
    User --- UC5
    User --- UC6
    User --- UC7
    User --- UC8
    User --- UC9
    User --- UC10
    User --- UC11
    User --- UC12

    UC3 -.->|«include»| UC3a
    UC3b -.->|«extend»| UC3
    UC4a -.->|«extend»| UC4

    UC3a --- LLM
    UC4a --- LLM
    UC8 --- LLM
```

## Use case → implementation

| Use case | Implementation |
|----------|----------------|
| Register / Log in | `POST /api/auth/register`, `POST /api/auth/login` — web `features/auth`, iOS `Views/Auth` + Keychain |
| Complete onboarding | web `features/onboarding` (Mifflin–St Jeor in `entities/user/model/profile.ts`), iOS `Views/Onboarding` + `GoalCalculator` |
| Scan meal photo | `POST /api/meals/analyze` → genai `/api/analyze` — web `features/scan-meal`, iOS `Views/Log` |
| — Recognize dish with vision LLM «include» | genai-service `nutrition_analyzer.py` (Gemini primary, Nemotron backup) |
| — Enter nutrition manually «extend» | `POST /api/meals/photo` + `POST /api/meals/photo/:id/convert-manual` (fallback when GenAI unavailable) |
| Log meal manually | `POST /api/meals/manual` — web `features/manual-entry`, iOS `MealEditorView` |
| — Estimate nutrition from food name «extend» | `POST /api/meals/estimate` → genai text LLM |
| Browse food diary | `GET /api/meals?from&to` — web `pages/diary`, iOS `Views/History` |
| Edit / delete meal | `PUT /api/meals/:id`, `DELETE /api/meals/:id` — web `features/meal-detail`, iOS swipe-to-delete + editor |
| View analytics dashboard | web: `GET /api/analytics/daily·weekly` (`pages/home`), `GET /api/analytics/range` + `streak` (`pages/insights`); iOS `Views/Analytics` aggregates local SwiftData (streak synced); also surfaced by the iOS home-screen widget (`NutritionAppWidget`) |
| View RAG health insight | `GET /api/analytics/insight` → genai `/api/insight` (Weaviate-grounded) — web `features/health-insight` (web-only today) |
| Manage profile & daily goals | `PUT /api/goals` — web `pages/profile`, iOS `Views/Profile`; `PUT /api/users/me` — web `features/onboarding` (save step), iOS profile sync (the web profile page edits goals only) |
| Track water intake | web: local state on home page; iOS: `WaterLog` (SwiftData, local-only) |
| Set daily reminders | iOS: local notifications with time picker (`Services/NotificationsManager`); web: toggle only, no notifications |
| Export logs as CSV | iOS `Services/CSVExporter` + share sheet (iOS-only) |

> The original design-phase sketch is preserved as [`OLD_usecase-diagram.png`](OLD_usecase-diagram.png)
> to show how the scope evolved during the project.
