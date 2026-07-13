# Services

The server side is split into three Spring Boot microservices, plus a separate Python GenAI service.

| Service | Port | Schema | Responsibility |
|---------|------|--------|----------------|
| [auth-service](auth-service) | 8081 | `auth` | User registration, login, JWT issuance |
| [meals-service](meals-service) | 8082 | `meals` | Manual meal logging, photo analysis, food-name estimation |
| [analytics-service](analytics-service) | 8083 | `analytics` | Nutrition goals, daily/weekly aggregations, RAG health insights |
| [genai-service](genai-service) | 8084 | n/a | Food image analysis, name-based estimation, health-insight RAG |
| [common-security](common-security) | — | — | Shared library: JWT resource-server security + API error handling |

**Building.** `services/pom.xml` is an aggregator: `cd services && mvn verify` builds the shared
module first, then every service. To build a single service standalone, install the shared module
once (`mvn -f services/common-security/pom.xml install`) so Maven can resolve it.

## Cross-cutting design

**JWT.** `auth-service` issues tokens; the other two validate them with the same `APP_JWT_SECRET`. Token validation lives in the shared [common-security](common-security) module: a thin `JwtVerifier` (decode + extract `userId`, no DB lookup) and a `JwtAuthenticationFilter`, wired by auto-configuration in meals/analytics. auth-service defines its own `SecurityFilterChain` (public login/register endpoints), so the shared resource-server chain backs off there; it reuses the module's error-handling classes.

**Database.** One PostgreSQL instance, three schemas. Each service owns its schema and its Flyway migrations live under `src/main/resources/db/migration/`. The schemas themselves are created by `infra/postgres/init/01-create-schemas.sql` on first container start.

**Inter-service calls.** `analytics-service` calls `meals-service` over REST to fetch a user's meals for aggregation, propagating the caller's bearer token. For health insights it also calls `genai-service`. There's no service mesh — Kubernetes/compose service DNS is enough.

**GenAI service.** `genai-service` is a Python microservice that accepts images and text queries and returns nutrition estimates or RAG insights. Primary vision: Google Gemini (OpenAI-compatible endpoint). Backup vision: OpenRouter Nemotron when Gemini fails. Text LLM (AET Logos) powers food-name estimation and insight generation.

**Default goals.** `analytics-service` returns `204 No Content` for `GET /api/goals` until the user calls `PUT /api/goals` for the first time. No event from `auth-service` on registration is needed.

## Feature toggles (runtime flags)

`auth-service` exposes in-memory feature flags (W07 post-deployment pattern). Flip UI or behavior **without redeploying**:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/features/{name}` | Read flag (`false` if unset) |
| `PUT /api/features/{name}?enabled=true` | Enable / disable |
| `GET /api/features` | List all set flags |

| Flag | Effect when `true` |
|------|---------------------|
| `scan-vision-model-picker` | Scan modal shows Auto / Gemini / Nemotron before analyze |

### Local: enable the vision model picker

```bash
# 1. Stack running (genai + meals + auth + web)
docker compose up --build

# 2. Enable the picker (auth-service port 8081)
curl -X PUT "http://localhost:8081/api/features/scan-vision-model-picker?enabled=true"

# 3. Hard-refresh the web app, open Scan, pick Gemini or Nemotron, analyze a photo.
#    Result overlay shows e.g. "95% match · Gemini" or "… · Nemotron".
```

Ensure `.env` has `GEMINI_API_KEY` (or `OPENAI_API_KEY`) and `OPENROUTER_API_KEY` for Nemotron. See [docs/ai/vision-models.md](../docs/ai/vision-models.md) for model comparison.

Flags reset when auth-service restarts (in-memory). Protect `PUT` in production if needed.

## Running locally

From the repo root:

```bash
cp .env.example .env
docker compose up --build
```

That brings up Postgres, all three Spring services, genai-service, and the web client. Endpoints:

- Auth: <http://localhost:8081/swagger-ui.html>
- Meals: <http://localhost:8082/swagger-ui.html>
- Analytics: <http://localhost:8083/swagger-ui.html>
- GenAI: <http://localhost:8084/docs>

> Dev Compose does not set `APP_GENAI_BASE_URL` on meals-service, so photo analysis uses a placeholder analyzer unless you wire it manually. The k8s/Helm deploy does wire genai.

## Running a single service

Each service has its own `mvn spring-boot:run` flow if you only want to iterate on one:

```bash
cd services/auth-service
mvn spring-boot:run
```

Make sure Postgres is up first (e.g. `docker compose up -d postgres`).

## GenAI service

`genai-service` powers photo-based meal analysis and text-based food estimation. It receives a meal photo or food name, calls the configured LLM(s), resolves nutritional data from USDA/local cache, and returns calories and macros to meals-service or analytics-service over REST.

Supported inference backends:
- **Primary:** Google Gemini (`gemini-3.1-flash-lite`) via OpenAI-compatible API
- **Backup:** OpenRouter Nemotron (`nvidia/nemotron-nano-12b-v2-vl:free`; alternate: `nemotron-3-nano-omni-30b-a3b-reasoning:free`)
- **Text:** AET Logos `gpt-oss-120b` for `/api/estimate` and `/api/insight`

Operationally, it is treated like the other services: build it as a container, wire it into compose/Helm, and expose it on port `8084`.
