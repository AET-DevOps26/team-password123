# Analytics Service

Nutrition goals and daily/weekly progress reports.

- **Port**: 8083
- **DB schema**: `analytics` (table: `nutrition_goals`)
- **Calls** `meals-service` over REST to aggregate meal totals. Propagates the caller's bearer token.
- **Auth**: validates JWTs issued by `auth-service` using the shared `APP_JWT_SECRET`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/goals` | Current user's goal (returns `204 No Content` until first set) |
| PUT | `/api/goals` | Upsert the user's goal |
| GET | `/api/analytics/daily?date=YYYY-MM-DD` | Daily totals + delta vs. goal |
| GET | `/api/analytics/weekly?weekStart=YYYY-MM-DD` | Weekly totals + delta vs. goal × 7 |

All endpoints require a bearer token issued by `auth-service`.

Swagger UI: <http://localhost:8083/swagger-ui.html>

## Run locally

```bash
mvn spring-boot:run
```

Requires:
- Postgres with the `analytics` schema
- `meals-service` reachable at `MEALS_SERVICE_URL` (default `http://localhost:8082`)
- `APP_JWT_SECRET` matching `auth-service`
