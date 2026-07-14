# Auth Service

Identity, registration, login, and JWT issuance for the nutrition platform.

- **Port**: 8081
- **DB schema**: `auth` (table: `app_users`)
- **Issues** JWTs signed RS256 with the RSA private key (`APP_JWT_PRIVATE_KEY`). Only this service holds signing material; other services verify with the public key (`APP_JWT_PUBLIC_KEY`). Generate a dev keypair with `node scripts/gen-jwt-keys.mjs`.

## Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/auth/register` | public | Creates a user and returns a JWT |
| POST | `/api/auth/login` | public | Returns a JWT |
| GET | `/api/users/me` | bearer | Current user's profile |
| PUT | `/api/users/me` | bearer | Replace the current user's profile (display name + height/weight/age/sex/activity/goal) |

Swagger UI: <http://localhost:8081/swagger-ui.html>

## Run locally

```bash
mvn spring-boot:run
```

Requires Postgres running with the `auth` schema (created automatically by the root `docker-compose.yml` init script).
