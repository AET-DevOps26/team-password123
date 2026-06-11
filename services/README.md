# Services

The server side is split into three Spring Boot microservices, plus a separate Python GenAI service. 

| Service | Port | Schema | Responsibility |
|---------|------|--------|----------------|
| [auth-service](auth-service) | 8081 | `auth` | User registration, login, JWT issuance |
| [meals-service](meals-service) | 8082 | `meals` | Manual meal logging and photo placeholders |
| [analytics-service](analytics-service) | 8083 | `analytics` | Nutrition goals and daily/weekly aggregations |
| [genai-service](genai-service) | 8084 | n/a | Food image analysis and nutrition inference |

## Cross-cutting design

**JWT.** `auth-service` issues tokens; the other two validate them with the same `APP_JWT_SECRET`. Each downstream service runs a thin `JwtVerifier` that decodes the token and extracts `userId` — no DB lookup, no shared library.

**Database.** One PostgreSQL instance, three schemas. Each service owns its schema and its Flyway migrations live under `src/main/resources/db/migration/`. The schemas themselves are created by `infra/postgres/init/01-create-schemas.sql` on first container start.

**Inter-service calls.** `analytics-service` calls `meals-service` over REST to fetch a user's meals for aggregation, propagating the caller's bearer token. There's no service mesh — Kubernetes/compose service DNS is enough.

**GenAI service.** `genai-service` is a Python microservice that accepts an image and returns a nutrition estimate. It can talk to a local Ollama model or a cloud provider such as OpenAI, so the rest of the system only depends on a single REST interface.

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

## GenAI service

`genai-service` is the image-analysis component of the system. It receives a meal photo, identifies foods, and estimates calories and macros, then returns the result to the meals flow over REST.

Supported inference backends:
- Local Ollama for offline or demo use
- Cloud providers such as OpenAI for fallback or faster setup

Operationally, it is treated like the other services: build it as a container, wire it into compose, and expose it on its own port (`8084`).
