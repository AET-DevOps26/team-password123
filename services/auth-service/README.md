# Auth Service

Identity, registration, login, and JWT issuance for the nutrition platform.

- **Port**: 8081
- **DB schema**: `auth` (table: `app_users`)
- **Issues** JWTs signed with `APP_JWT_SECRET`. Other services validate using the same secret.

## Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/auth/register` | public | Creates a user and returns a JWT |
| POST | `/api/auth/login` | public | Returns a JWT |
| GET | `/api/users/me` | bearer | Current user's profile |
| GET | `/api/users/{id}` | bearer | User lookup by id (used internally by other services if needed) |

Swagger UI: <http://localhost:8081/swagger-ui.html>

## Run locally

```bash
mvn spring-boot:run
```

Requires Postgres running with the `auth` schema (created automatically by the root `docker-compose.yml` init script).
