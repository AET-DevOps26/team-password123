# API Reference

All backend services are protected with JWT bearer tokens unless marked **public**.  
Token is obtained from `POST /api/auth/login` or `POST /api/auth/register`.  
Include it as: `Authorization: Bearer <token>`

Live interactive docs (Swagger UI) are available at each service's `/swagger-ui.html`.

---

## auth-service — port 8081

### POST `/api/auth/register` · public

Create a new account and return a token immediately.

**Request body**
```json
{
  "email": "user@example.com",
  "password": "secret123",
  "displayName": "Alice"
}
```
| Field | Type | Constraints |
|-------|------|-------------|
| `email` | string | valid email, required |
| `password` | string | 8–100 chars, required |
| `displayName` | string | max 120 chars, required |

**Response `201`**
```json
{
  "tokenType": "Bearer",
  "accessToken": "eyJ...",
  "expiresAt": "2026-06-19T10:00:00Z",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "displayName": "Alice"
}
```

---

### POST `/api/auth/login` · public

**Request body**
```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Response `200`** — same shape as register response above.

**Error `401`** — wrong credentials.

---

### GET `/api/users/me` · bearer

Return the current user's profile.

**Response `200`**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "displayName": "Alice",
  "createdAt": "2026-05-10T09:00:00Z",
  "heightCm": 170,
  "weightKg": 65.0,
  "age": 28,
  "sex": "female",
  "activityLevel": "moderate",
  "goal": "maintain"
}
```

**Enums**
| Field | Values |
|-------|--------|
| `sex` | `male`, `female`, `other` |
| `activityLevel` | `sedentary`, `light`, `moderate`, `active`, `veryActive` |
| `goal` | `lose`, `maintain`, `gain` |

Profile fields (`heightCm`, `weightKg`, `age`, `sex`, `activityLevel`, `goal`) are `null` until the user completes onboarding.

---

### PUT `/api/users/me` · bearer

Replace the current user's profile. All fields are required.

**Request body**
```json
{
  "displayName": "Alice",
  "heightCm": 170,
  "weightKg": 65.0,
  "age": 28,
  "sex": "female",
  "activityLevel": "moderate",
  "goal": "maintain"
}
```
| Field | Constraints |
|-------|-------------|
| `displayName` | max 120 chars, required |
| `heightCm` | 50–300 |
| `weightKg` | positive |
| `age` | 1–150 |

**Response `200`** — updated `UserResponse` (same shape as GET above).

---

## meals-service — port 8082

### POST `/api/meals/manual` · bearer

Log a meal manually with full macro detail.

**Request body**
```json
{
  "mealType": "LUNCH",
  "loggedAt": "2026-06-18T12:30:00Z",
  "notes": "Homemade bowl",
  "items": [
    {
      "name": "Chicken breast",
      "quantity": 150,
      "unit": "g",
      "calories": 247.5,
      "proteinGrams": 46.5,
      "carbsGrams": 0,
      "fatGrams": 5.4,
      "fiberGrams": 0
    }
  ]
}
```
| Field | Constraints |
|-------|-------------|
| `mealType` | `BREAKFAST`, `LUNCH`, `DINNER`, `SNACK` — required |
| `loggedAt` | ISO 8601 datetime; defaults to now if omitted |
| `notes` | max 500 chars, optional |
| `items` | at least one item required |
| `items[].name` | max 160 chars, required |
| `items[].quantity` | positive, required |
| `items[].unit` | max 40 chars, required (e.g. `g`, `ml`, `piece`) |
| `items[].calories` | ≥ 0, required |
| `items[].proteinGrams` | ≥ 0, required |
| `items[].carbsGrams` | ≥ 0, required |
| `items[].fatGrams` | ≥ 0, required |
| `items[].fiberGrams` | ≥ 0, required |

**Response `201`** — `MealResponse`
```json
{
  "id": "uuid",
  "mealType": "LUNCH",
  "loggedAt": "2026-06-18T12:30:00Z",
  "sourceType": "MANUAL",
  "calories": 247.5,
  "proteinGrams": 46.5,
  "carbsGrams": 0,
  "fatGrams": 5.4,
  "fiberGrams": 0,
  "notes": "Homemade bowl",
  "items": [
    {
      "id": "uuid",
      "name": "Chicken breast",
      "quantity": 150,
      "unit": "g",
      "calories": 247.5,
      "proteinGrams": 46.5,
      "carbsGrams": 0,
      "fatGrams": 5.4,
      "fiberGrams": 0
    }
  ]
}
```

---

### GET `/api/meals` · bearer

List meals within a date range.

**Query params**
| Param | Type | Example | Notes |
|-------|------|---------|-------|
| `from` | ISO date | `2026-06-01` | required |
| `to` | ISO date | `2026-06-18` | required |
| `tz` | IANA timezone | `Europe/Berlin` | optional; day boundaries for `from`/`to` are bucketed in this zone. Defaults to UTC; a malformed value is a 400. |

**Response `200`** — array of `MealResponse`.

---

### GET `/api/meals/{id}` · bearer

**Response `200`** — single `MealResponse`.  
**Response `404`** — not found or belongs to another user.

---

### PUT `/api/meals/{id}` · bearer

Replace a meal log. Same request body as `POST /api/meals/manual`.

**Response `200`** — updated `MealResponse`.

---

### DELETE `/api/meals/{id}` · bearer

**Response `204`** — no content.

---

### GET `/api/meals/logged-dates` · bearer

Distinct local dates in the range with at least one logged meal. Used internally by analytics-service for the logging-streak computation — it avoids transferring full meal bodies.

**Query params** — `from` / `to`, ISO dates, both required; optional `tz` (IANA timezone, default UTC) buckets each meal onto its local calendar day (same contract as `GET /api/meals`).

**Response `200`** — sorted array of ISO dates:
```json
["2026-06-16", "2026-06-18"]
```

---

### POST `/api/meals/analyze` · bearer

Upload a photo and get macro estimates from the GenAI service. The meal is **automatically logged** on success.

**Request** — `multipart/form-data`
| Part | Type | Notes |
|------|------|-------|
| `file` | image (JPG/PNG/WEBP) | required |

**Query params** — optional `tz` (IANA timezone, default UTC): the auto-picked meal slot (breakfast/lunch/dinner/snack) is derived from the hour in this zone.

**Response `200`** — `MealAnalysisResponse`
```json
{
  "meal": {
    "id": "uuid",
    "dishName": "Grilled chicken with broccoli",
    "imageUrl": "/api/meals/photo/uuid/raw",
    "nutrition": {
      "calories": 350.0,
      "protein": 45.0,
      "carbs": 12.0,
      "fat": 9.0
    },
    "confidence": 0.87,
    "analyzedAt": "2026-06-18T12:35:00Z"
  },
  "message": "Meal analyzed and logged"
}
```

---

### POST `/api/meals/photo` · bearer

Upload a photo without triggering analysis (stores raw photo only).

**Request** — `multipart/form-data` with `file` part.

**Response `201`** — `PhotoLogResponse`
```json
{
  "id": "uuid",
  "originalFilename": "lunch.jpg",
  "contentType": "image/jpeg",
  "status": "PENDING",
  "linkedMealLogId": null,
  "createdAt": "2026-06-18T12:30:00Z"
}
```
`status` values: `PENDING`, `ANALYZED`, `FAILED`, `AI_NOT_AVAILABLE`

---

### GET `/api/meals/photo/{id}/raw` · bearer

Stream the stored photo image. Returns the original binary content.

**Response `200`** — image bytes with correct `Content-Type`.

---

### POST `/api/meals/photo/{id}/convert-manual` · bearer

Attach manually entered macros to an existing photo log and create a linked `MealLog`.

**Request body** — same shape as `POST /api/meals/manual`.

**Response `200`** — `MealResponse`.

---

## analytics-service — port 8083

### GET `/api/goals` · bearer

Return the current user's daily nutrition goal.

**Response `200`**
```json
{
  "id": "uuid",
  "dailyCalories": 2000.0,
  "proteinGrams": 150.0,
  "carbsGrams": 200.0,
  "fatGrams": 65.0,
  "fiberGrams": 30.0,
  "updatedAt": "2026-06-10T08:00:00Z"
}
```
**Response `204`** — no goal set yet (first-time users).

---

### PUT `/api/goals` · bearer

Create or replace the user's daily nutrition goal (upsert).

**Request body**
```json
{
  "dailyCalories": 2000.0,
  "proteinGrams": 150.0,
  "carbsGrams": 200.0,
  "fatGrams": 65.0,
  "fiberGrams": 30.0
}
```
All fields: decimal ≥ 0, required.

**Response `200`** — `GoalResponse` (same shape as GET above).

---

### GET `/api/analytics/daily` · bearer

Daily nutrition totals vs. goal.

**Query params**
| Param | Type | Example |
|-------|------|---------|
| `date` | ISO date | `2026-06-18` |
| `tz` | IANA timezone (optional) | `Europe/Berlin` |

`tz` (default UTC) sets the day boundary; it is forwarded to meals-service so the totals cover the user's local `date`.

**Response `200`** — `AnalyticsResponse`
```json
{
  "from": "2026-06-18",
  "to": "2026-06-18",
  "mealCount": 3,
  "calories": 1850.0,
  "proteinGrams": 130.0,
  "carbsGrams": 180.0,
  "fatGrams": 55.0,
  "fiberGrams": 22.0,
  "calorieGoalDelta": -150.0,
  "proteinGoalDelta": -20.0,
  "carbsGoalDelta": -20.0,
  "fatGoalDelta": -10.0,
  "fiberGoalDelta": -8.0
}
```
`*GoalDelta` = actual − goal (negative means below goal).

---

### GET `/api/analytics/weekly` · bearer

7-day window starting from `weekStart`.

**Query params**
| Param | Type | Example |
|-------|------|---------|
| `weekStart` | ISO date (Monday) | `2026-06-16` |
| `tz` | IANA timezone (optional) | `Europe/Berlin` |

`tz` (default UTC) sets the day boundary, same as `GET /api/analytics/daily`.

**Response `200`** — same `AnalyticsResponse` shape, `from`=weekStart, `to`=weekStart+6.

---

### GET `/api/analytics/streak` · bearer

Number of consecutive days the user has logged at least one meal.

**Query params** — optional `tz` (IANA timezone, default UTC): "today" and the day bucketing are computed in this zone, so the streak matches the user's local calendar.

**Response `200`**
```json
{ "streak": 7 }
```

---

## genai-service — port 8084

> **Production config:** The deployed service uses Google Gemini (`gemini-3.1-flash-lite`) via its OpenAI-compatible endpoint. `LLM_PROVIDER=openai`, `OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/`. OpenRouter Nemotron is the automatic fallback when Gemini fails.

### GET `/health` · public

**Response `200`**
```json
{
  "status": "ok",
  "service": "genai-service",
  "analyzer_ready": true,
  "timestamp": "2026-06-18T09:30:00Z"
}
```
`status` is `"degraded"` if the LLM failed to initialise (missing API key, etc.).

---

### POST `/api/analyze` · public

Analyze a food image. Returns macro estimates and a confidence score.

**Request** — `multipart/form-data`
| Part | Type | Notes |
|------|------|-------|
| `file` | image (JPG/PNG/WEBP) | required |

**Response `200`**
```json
{
  "foods": ["grilled chicken", "broccoli"],
  "calories": 350.0,
  "protein_grams": 45.0,
  "carbs_grams": 12.0,
  "fat_grams": 9.0,
  "fiber_grams": 4.5,
  "confidence": 0.87
}
```
`confidence` is a 0–1 score produced by the LLM. Values below 0.4 indicate the model was uncertain.

**Error `400`** — empty or invalid file.  
**Error `503`** — LLM not initialised.

---

### POST `/api/analyze/compare` · internal

Analyze the same image with two providers and compare calorie estimates.
Manual-experiment tool for comparing vision providers — hidden from the
OpenAPI schema and not called by any service.

**Request** — `multipart/form-data` with `file` part.

**Response `200`**
```json
{
  "primary": {
    "provider": "openai",
    "foods": ["pizza slice"],
    "calories": 285.0,
    "protein_grams": 11.0,
    "carbs_grams": 36.0,
    "fat_grams": 10.0,
    "fiber_grams": 2.0,
    "confidence": 0.82
  },
  "secondary": {
    "provider": "google",
    "foods": ["pizza"],
    "calories": 310.0,
    "protein_grams": 12.0,
    "carbs_grams": 38.0,
    "fat_grams": 11.0,
    "fiber_grams": 2.5,
    "confidence": 0.74
  },
  "calorie_difference": 25.0,
  "calorie_difference_percent": 8.77
}
```

---

## Common error shape

All services return the same error envelope:

```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "Validation failed: email must be a valid email address",
  "timestamp": "2026-06-18T09:30:00Z"
}
```
