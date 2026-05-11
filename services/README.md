# Services

The server side is split into three Spring Boot microservices, each with its own database schema and Dockerfile.

| Service | Port | Schema | Responsibility |
|---------|------|--------|----------------|
| [auth-service](auth-service) | 8081 | `auth` | User registration, login, JWT issuance |
| [meals-service](meals-service) | 8082 | `meals` | Manual meal logging and photo placeholders |
| [analytics-service](analytics-service) | 8083 | `analytics` | Nutrition goals and daily/weekly aggregations |

## Cross-cutting design

**JWT.** `auth-service` issues tokens; the other two validate them with the same `APP_JWT_SECRET`. Each downstream service runs a thin `JwtVerifier` that decodes the token and extracts `userId` — no DB lookup, no shared library.

**Database.** One PostgreSQL instance, three schemas. Each service owns its schema and its Flyway migrations live under `src/main/resources/db/migration/`. The schemas themselves are created by `infra/postgres/init/01-create-schemas.sql` on first container start.

**Inter-service calls.** `analytics-service` calls `meals-service` over REST to fetch a user's meals for aggregation, propagating the caller's bearer token. There's no service mesh — Kubernetes/compose service DNS is enough.

**Default goals.** `analytics-service` returns `204 No Content` for `GET /api/goals` until the user calls `PUT /api/goals` for the first time. No event from `auth-service` on registration is needed.

## Running locally

From the repo root:

```bash
cp .env.example .env
docker compose up --build
```

That brings up Postgres + all three services. Endpoints:

- Auth: <http://localhost:8081/swagger-ui.html>
- Meals: <http://localhost:8082/swagger-ui.html>
- Analytics: <http://localhost:8083/swagger-ui.html>

## Running a single service

Each service has its own `mvn spring-boot:run` flow if you only want to iterate on one:

```bash
cd services/auth-service
mvn spring-boot:run
```

Make sure Postgres is up first (e.g. `docker compose up -d postgres`).
