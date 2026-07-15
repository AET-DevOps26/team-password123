# Meals Service

Manual meal logging, photo analysis, and food-name estimation.

- **Port**: 8082
- **DB schema**: `meals` (tables: `meal_logs`, `meal_items`, `photo_logs`)
- **Auth**: verifies RS256 JWTs issued by `auth-service` using the public key only (`APP_JWT_PUBLIC_KEY`) — it cannot mint tokens. Does not own users.

Photo uploads via `POST /api/meals/analyze` are routed to genai-service when `APP_GENAI_BASE_URL` / `GENAI_SERVICE_URL` is set (Helm/k8s). Otherwise a deterministic placeholder analyzer is used for local dev. Photo logs without analysis can be converted to manual meals via `POST /api/meals/photo/{id}/convert-manual`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/meals/manual` | Create a manual meal log |
| GET | `/api/meals?from=...&to=...` | List the user's meals in a date range |
| GET | `/api/meals/{id}` | Get a meal |
| PUT | `/api/meals/{id}` | Update a meal |
| DELETE | `/api/meals/{id}` | Delete a meal |
| POST | `/api/meals/photo` | Upload a photo (stores file; no AI analysis) |
| POST | `/api/meals/analyze` | Upload a photo, run GenAI analyzer, and log the meal |
| POST | `/api/meals/estimate` | Estimate per-100g nutrition for a food name (via genai) |
| GET | `/api/meals/photo/{id}/raw` | Stream a stored photo image (owner only) |
| POST | `/api/meals/photo/{id}/convert-manual` | Attach manual macros to a photo log |

All endpoints require a bearer token issued by `auth-service`.

Swagger UI: <http://localhost:8082/swagger-ui.html>

## Run locally

```bash
mvn spring-boot:run
```

Requires Postgres running with the `meals` schema. Set `APP_JWT_PUBLIC_KEY` to the public key matching auth-service's `APP_JWT_PRIVATE_KEY` (generate a pair with `node scripts/gen-jwt-keys.mjs`). Set `APP_GENAI_BASE_URL=http://localhost:8084` to use the real GenAI analyzer locally.
