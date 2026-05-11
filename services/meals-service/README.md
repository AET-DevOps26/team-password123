# Meals Service

Manual meal logging and photo-log placeholders.

- **Port**: 8082
- **DB schema**: `meals` (tables: `meal_logs`, `meal_items`, `photo_logs`)
- **Auth**: validates JWTs issued by `auth-service` using the shared `APP_JWT_SECRET`. Does not own users.

Photo uploads currently land with status `AI_NOT_AVAILABLE` — the GenAI service is not yet wired in. They can be converted to manual meals via `POST /api/meals/photo/{id}/convert-manual`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/meals/manual` | Create a manual meal log |
| GET | `/api/meals?from=...&to=...` | List the user's meals in a date range |
| GET | `/api/meals/{id}` | Get a meal |
| PUT | `/api/meals/{id}` | Update a meal |
| DELETE | `/api/meals/{id}` | Delete a meal |
| POST | `/api/meals/photo` | Upload a photo (placeholder until GenAI lands) |
| POST | `/api/meals/photo/{id}/convert-manual` | Attach manual macros to a photo log |

All endpoints require a bearer token issued by `auth-service`.

Swagger UI: <http://localhost:8082/swagger-ui.html>

## Run locally

```bash
mvn spring-boot:run
```

Requires Postgres running with the `meals` schema. Set `APP_JWT_SECRET` to the same value as `auth-service`.
