# Calorieasy — Team password123

A nutrition and health companion that removes the friction from food logging, built as a university DevOps course project (org **AET-DevOps26**, repo **team-password123**). Snap a photo of a meal, get calories and macros back instantly via GenAI, and track long-term trends in an analytics dashboard.

- **Photo → nutrition.** Upload a meal photo; the GenAI service (vision LLM) returns identified foods, calories, and macros (protein/carbs/fat/fiber) with a confidence score.
- **Manual logging.** Add meals and macros by hand; edit and delete entries.
- **Diary.** Per-day food log with day-to-day navigation.
- **Analytics.** Daily and weekly aggregates with goal deltas and a logging streak.
- **Goals.** Per-user nutrition goals (calories + macros), with Mifflin–St Jeor TDEE suggestions in onboarding.
- **Auth.** Email/password registration and login with JWT; one shared signing secret validated by every service.
- **iOS app.** SwiftUI + SwiftData client with backend sync (auth, meals, goals, GenAI photo analyze). Water tracking and widget stay local-only.

| Path | What's there |
|------|--------------|
| [`calorie-app/`](calorie-app) | React + TypeScript web client (Vite, Feature-Sliced Design). Port 3000. |
| [`services/auth-service/`](services/auth-service) | Identity, registration, login, JWT issuance. Port 8081, schema `auth`. |
| [`services/meals-service/`](services/meals-service) | Manual meal logging + photo scan with GenAI analysis. Port 8082, schema `meals`. |
| [`services/analytics-service/`](services/analytics-service) | Goals and daily/weekly aggregations. Port 8083, schema `analytics`. |
| [`services/genai-service/`](services/genai-service) | Python FastAPI vision service (Gemini primary in prod, OpenAI-compatible backup API). Port 8084. |
| [`ios-app/`](ios-app) | SwiftUI + SwiftData iOS client (offline cache + backend sync) |
| [`helm/calorieasy/`](helm/calorieasy) | Kubernetes Helm chart for AET cluster deployment. |
| [`infra/`](infra) | Terraform (Azure VM) + Ansible (Docker Compose deploy). |
| [`docs/`](docs) | Problem statement, system architecture, API reference, sprint plan. |

## Architecture

A single-page web client and an iOS client talk to three Spring Boot REST microservices behind one PostgreSQL instance (one database, three schemas). The meals service can delegate image recognition to the Python GenAI service. **Only `auth-service` issues JWTs**; meals and analytics validate them with the same shared `APP_JWT_SECRET`. `analytics-service` is a read-side aggregator — it does not store meals; it fetches them live from `meals-service` over HTTP, forwarding the caller's bearer token.

```
                         ┌──────────────────────────────────────────────┐
   Web client (SPA)      │  Reverse proxy (/api/*)                       │
   Vite dev :3000        │  · dev:  Vite proxy (per-service)             │
   nginx prod :80   ───► │  · prod: nginx (in the web image)             │
   iOS app (local-only)  └───────────────┬──────────────────────────────┘
                                          │  Authorization: Bearer <JWT>
              ┌───────────────────────────┼───────────────────────────┐
              ▼                           ▼                           ▼
   ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────────┐
   │   auth-service    │      │   meals-service   │      │   analytics-service   │
   │      :8081        │      │      :8082        │      │        :8083          │
   │  /api/auth        │      │  /api/meals       │      │  /api/analytics       │
   │  /api/users       │      │  (issues no JWT;  │      │  /api/goals           │
   │  ISSUES JWT  ─────┼──┐   │   validates JWT)  │◄─────┤  (validates JWT;      │
   │                   │  │   │                   │ GET  │   no meal storage)    │
   └─────────┬─────────┘  │   └─────────┬─────────┘/api/ └───────────┬───────────┘
             │            │             │           meals            │
             │  shared    │             │ POST /api/analyze          │
             │  APP_JWT_  │             ▼  (when app.genai.base-url  │
             │  SECRET    │   ┌───────────────────┐    is set)       │
             │  (validate)└──►│   genai-service   │                  │
             │                │      :8084        │                  │
             │                │  FastAPI + vision │                  │
             │                │  LLM (Gemini +   │                  │
             │                │  Nemotron backup)│                  │
             │                └───────────────────┘                  │
             ▼                          ▼                            ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  PostgreSQL 16  (DB: nutrition)   schemas: auth | meals | analytics        │
   │  :5432                            Flyway migrations per service            │
   └──────────────────────────────────────────────────────────────────────────┘
```

Design docs live in [`docs/`](docs/): [`Problem Statement.md`](docs/Problem%20Statement.md), [`System Architecture.md`](docs/System%20Architecture.md), and the UML diagrams (`usecase-diagram.png`, `sys-architecture.png`, `object-diagram.png`). Note the architecture diagram predates the split into three Spring services and still shows a single "Spring Boot API" box.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Web client | React 18.2, TypeScript 5.3, Vite 5, Zustand 5, CSS Modules, Vitest |
| Backend services | Java 21, Spring Boot 3.5.13 (Web MVC, Data JPA, Security, Actuator, Validation), Maven |
| Auth | JJWT 0.12.6 (HMAC-SHA), BCrypt, shared `APP_JWT_SECRET` |
| Persistence | PostgreSQL 16, Flyway migrations, Hibernate `ddl-auto=validate` |
| GenAI service | Python 3.11, FastAPI 0.104, uvicorn, LangChain, Pydantic 2 |
| Vision LLMs | Google Gemini (primary, OpenAI-compatible), Nemotron via OpenRouter (backup) |
| Nutrition data | USDA FoodData Central with a local `nutrition_db.json` cache fallback |
| iOS | Swift 5, SwiftUI, SwiftData, WidgetKit, Swift Charts (xcodegen project) |
| API docs | springdoc-openapi (Swagger UI) per Spring service; FastAPI `/docs` for GenAI |
| Infra / CI | Docker Compose, Helm v3, Kubernetes (AET cluster), Terraform + Ansible (Azure VM), GitHub Actions, GHCR |

## Quick start (Docker Compose)

### Run locally without AI (seeded demo data)

The fastest way to try the full web app. This skips the GenAI service entirely
— every feature works except photo recognition, which falls
back to manual entry. Demo data is loaded into the real database via the seed
script, so the app runs against the real backend.

Requires Docker and Node.js 18+.

```bash
# From the repo root:
cp .env.example .env

# 1. Start everything except the GenAI service (postgres + the 3 services + web):
docker compose up --build postgres auth-service meals-service analytics-service web

# 2. Once the services are up, seed one demo user + ~10 days of meals:
node scripts/seed.mjs          # or: make seed
```

Then open <http://localhost:3000> and log in with:

- **Email:** `dev@local.com`
- **Password:** `password123`

The profile, daily goals, diary history, insights, and logging streak are all
populated from the seeded data. The "Scan meal" button works too — without the
AI service it just routes to the manual nutrition form.

Seed options: re-running clears the seed user's existing meals first, so you
always get a clean dataset (pass `--keep` to append instead). Override with
`SEED_DAYS`, `SEED_EMAIL`, `SEED_PASSWORD`. See [`scripts/seed.mjs`](scripts/seed.mjs).

### Full stack with GenAI

Brings up Postgres + the three Spring services + the GenAI service + the web client (Vite dev server) on one machine.

### Prerequisites
- Docker + Docker Compose v2
- A **Google AI Studio** key for Gemini (primary) and optionally an **OpenRouter** key for the Nemotron backup — see [Configuration](#configuration)

> The dev Compose stack does **not** wire `meals-service` to `genai-service` (no `APP_GENAI_BASE_URL`), so under Compose photo analysis uses a deterministic placeholder analyzer rather than the real GenAI link. The GenAI service still runs and is reachable directly on `:8084`. The GenAI link is wired only in the Helm/k8s path.

### Run
```bash
cp .env.example .env   # fill OPENAI_API_KEY + BACKUP_OPENAI_API_KEY
docker compose up --build
```

App opens at **http://localhost:3000**. All five services + Postgres come up in one command.

To pre-populate demo data (one user + ~10 days of meals), run the seed script once the services are up:
```bash
node scripts/seed.mjs          # or: make seed
```
After seeding, hard refresh the browser tab if the app is already open, then log in with `dev@local.com` / `password123`.

Provider is selected with `LLM_PROVIDER` (`openai` | `google`); see [Configuration](#configuration).

### iOS app — `ios-app/`
SwiftUI + SwiftData client with backend sync (auth, meals, goals, GenAI analyze). Water tracking and widget stay local. Requires macOS + Xcode 15+ (iOS 17 SDK) and `xcodegen`.
```bash
cd ios-app
xcodegen generate           # regenerate NutritionApp.xcodeproj from project.yml
open NutritionApp.xcodeproj
# select the NutritionApp scheme + an iOS 17 simulator, then Cmd-R
```
Optional scheme launch arguments: `--seed-sample-data` (7 days of meals/water), `--skip-onboarding`. Headless build:
```bash
xcodebuild -project NutritionApp.xcodeproj -scheme NutritionApp \
  -destination 'platform=iOS Simulator,name=iPhone 15' build
```

## API reference

All Spring endpoints are served under the `/api` prefix; all except registration/login/health/Swagger require `Authorization: Bearer <JWT>`.

### auth-service (`:8081`)
| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/api/auth/register` | Create user, returns `AuthResponse` (JWT); public |
| `POST` | `/api/auth/login` | Authenticate, returns `AuthResponse` (JWT); public |
| `GET` | `/api/users/me` | Current user's profile (from JWT) |
| `PUT` | `/api/users/me` | Full-replace profile (name + body metrics + activity/goal) |
| `GET` | `/actuator/health`, `/swagger-ui.html` | Public |

JWT subject is the user's email; the user id is a custom `userId` claim. The auth filter re-loads the user from the DB on every request. Token TTL is an ISO-8601 duration (`APP_JWT_EXPIRATION`, default `PT24H`).

### meals-service (`:8082`)
| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/api/meals/manual` | Create a manual meal; sums item macros; `source=MANUAL` |
| `GET` | `/api/meals?from=YYYY-MM-DD&to=YYYY-MM-DD` | List caller's meals in an inclusive date range |
| `GET` | `/api/meals/{id}` | Get one owned meal |
| `PUT` | `/api/meals/{id}` | Update an owned meal |
| `DELETE` | `/api/meals/{id}` | Delete an owned meal (204) |
| `POST` | `/api/meals/photo` | Multipart `file`; stores image, status `AI_NOT_AVAILABLE` (no analysis) |
| `POST` | `/api/meals/photo/{id}/convert-manual` | Attach manual macros to a photo log |
| `POST` | `/api/meals/analyze` | Multipart `image`; runs GenAI analyzer; `source=PHOTO_AI` |
| `POST` | `/api/meals/estimate` | JSON `{ "foodName": "..." }`; per-100g nutrition estimate via genai |
| `GET` | `/api/meals/photo/{id}/raw` | Stream stored photo bytes (owner only) |

> `POST /api/meals/photo` only stores the file and never triggers AI. Image analysis happens only via `POST /api/meals/analyze`. When `app.genai.base-url` is set, that endpoint calls the GenAI service at `POST /api/analyze`; otherwise it uses a deterministic, non-AI placeholder analyzer. Multipart upload limit is 10 MB.

### analytics-service (`:8083`)
| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/analytics/daily?date=YYYY-MM-DD` | Daily totals + per-macro goal deltas |
| `GET` | `/api/analytics/weekly?weekStart=YYYY-MM-DD` | 7-day totals + deltas vs. (daily goal × 7) |
| `GET` | `/api/analytics/range?from=DATE&to=DATE` | Per-day totals for a range (≤400 days, empty days omitted) |
| `GET` | `/api/analytics/streak` | Consecutive-days logging streak (~5-year window) |
| `GET` | `/api/analytics/insight?window=week` | RAG health insight from recent meals (via genai) |
| `GET` | `/api/goals` | Current user's goal, or `204` if none set |
| `PUT` | `/api/goals` | Upsert nutrition goal (`GoalRequest`; includes `fiberGrams`) |
### Swagger UI (local)

| Service | URL |
|---------|-----|
| Auth | http://localhost:8081/swagger-ui.html |
| Meals | http://localhost:8082/swagger-ui.html |
| Analytics | http://localhost:8083/swagger-ui.html |
| GenAI | http://localhost:8084/docs |

### Production (AET Kubernetes)

Live at **https://team-password123-devops-ss26.stud.k8s.aet.cit.tum.de**

Deployed automatically on every push to `main` via Helm. GenAI uses Google Gemini in production with OpenRouter Nemotron as automatic fallback when Gemini fails.

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full deployment guide.

Goal deltas are `actual − target`; with no goal set, target is treated as 0. If `meals-service` is down, analytics returns `502`.

### genai-service (`:8084`)
| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/health` | Readiness (`ok` / `degraded`) |
| `POST` | `/api/analyze` | Multipart `file` → `NutritionResponse` (foods, calories, protein/carbs/fat/fiber grams, confidence) |
| `POST` | `/api/analyze/compare` | Internal (hidden from OpenAPI): run two providers and compare calorie estimates |
| `POST` | `/api/estimate` | JSON `{ "foodName": "..." }` → per-100g nutrition estimate |
| `POST` | `/api/insight` | JSON eating profile → RAG health insight |

`meals-service` calls only `POST /api/analyze` (multipart field `file`) and ignores `fiber_grams` in its mapping.

## Configuration

### Shared / Postgres ([`.env.example`](.env.example))
| Variable | Default | Purpose |
|----------|---------|---------|
| `POSTGRES_DB` | `nutrition` | Database name |
| `POSTGRES_USER` | `nutrition` | DB user |
| `POSTGRES_PASSWORD` | `nutrition` (dev) | DB password — **required** in prod |
| `APP_JWT_SECRET` | dev placeholder | HMAC secret shared by all Spring services — **override in prod** |
| `APP_JWT_EXPIRATION` | `PT24H` | JWT TTL (ISO-8601 duration) |

### Spring services
| Variable | Default | Purpose |
|----------|---------|---------|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/nutrition?currentSchema=<svc>` | Per-service JDBC URL |
| `SPRING_DATASOURCE_USERNAME` / `_PASSWORD` | `nutrition` / `nutrition` | DB creds |
| `SERVER_PORT` | `8081` / `8082` / `8083` | HTTP port |
| `APP_UPLOAD_DIR` | `uploads` | meals-service photo storage dir |
| `MEALS_SERVICE_URL` | `http://localhost:8082` | analytics → meals base URL |
| `APP_GENAI_BASE_URL` | unset | meals: activates the GenAI analyzer (`{base}/api/analyze`) when set |

### GenAI service ([`services/genai-service/.env.example`](services/genai-service/.env.example))
| Variable | Default | Purpose |
|----------|---------|---------|
| `LLM_PROVIDER` | `openai` | `openai` \| `google` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_BASE_URL` | _empty_ / `gemini-3.1-flash-lite` / Gemini OpenAI-compatible URL | Primary vision LLM (Gemini in prod) |
| `BACKUP_OPENAI_API_KEY` / `BACKUP_OPENAI_MODEL` / `BACKUP_OPENAI_BASE_URL` | _empty_ | OpenRouter Nemotron fallback when primary fails |
| `GOOGLE_API_KEY` / `GOOGLE_MODEL` | _empty_ / `gemini-2.0-flash` | Native Google path (optional) |
| `NUTRITION_DATA_PROVIDER` | `usda` | `auto` \| `usda` \| `local` |
| `USDA_FDC_API_KEY` | _empty_ | Without it, USDA lookups are skipped and only the local cache is used |
| `PORT` / `DEBUG` | `8084` / `false` | Server port / debug logging |

**GenAI provider by environment.**
- **Dev / Compose / prod** → `openai` with Google Gemini primary plus OpenRouter Nemotron backup.
- **Helm / AET k8s** → same; deploy workflow may override base URL, model, and key with cluster secrets.

Gemini is reached via `LLM_PROVIDER=openai` plus a Gemini OpenAI-compatible `OPENAI_BASE_URL`, not the native `google` path.

### Web client
[`calorie-app/.env.example`](calorie-app/.env.example) holds the committed defaults; copy it to `calorie-app/.env.local` (gitignored) to override locally.

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_AUTH_API_URL` / `VITE_MEALS_API_URL` / `VITE_ANALYTICS_API_URL` | `:8081` / `:8082` / `:8083` | Per-service dev proxy targets, read by `vite.config.ts` |

## Testing

| Component | Command | Coverage |
|-----------|---------|----------|
| Web client | `cd calorie-app && npm test` | Vitest, 39 unit tests (profile goals, mappers, health insight card). No full-page component tests. |
| Backend services | `cd services && mvn test` | JUnit 5 + Mockito, unit-only; the aggregator builds the shared common-security module first, then auth (JwtService, AuthService, UserService), meals (MealService, MealMapper, GenAiMealAnalyzer mapping) and analytics (AnalyticsService, GoalService) |
| genai-service (unit) | `cd services/genai-service && pytest tests/test_nutrition_lookup.py -v` | Pure unit tests, no running server |
| genai-service (vision) | `pytest tests/test_vision_fallback.py -v -m "not integration"` | Gemini primary + backup fallback (mocked, no keys) |
| genai-service (backup smoke) | `pytest tests/test_vision_fallback.py -v -m "integration and backup"` | OpenRouter backup smoke only (skips without key) |
| genai-service (smoke) | `pytest tests/test_smoke.py -v` | HTTP smoke tests against a running service (auto-skips if down) |
| iOS app | — | No tests (the xcodegen project defines no test target) |

Backend tests are unit-only (mocked collaborators, no Spring context / DB). There are no `@SpringBootTest`/`@WebMvcTest` integration tests.

## Deployment & CI/CD

Four GitHub Actions workflows in [`.github/workflows/`](.github/workflows/):

- **`ci.yml`** — on every PR and push to `main`: a 3-way backend matrix installs the shared common-security module and runs `mvn -B -ntp verify` (JDK 21 temurin) for auth/meals/analytics; the frontend job runs `npm ci`, lint, `npm run build` (strict `tsc` + Vite build) and `npm test` (Node 20); a Playwright **e2e** job runs the browser flows; and a **genai** job runs `ruff` + `pytest` on the headless unit suites (Python 3.11).
- **`build-images.yml`** — on push to `main` (or manual dispatch): builds five `linux/amd64` images (auth-service, meals-service, analytics-service, genai-service, web) and pushes them to GHCR tagged `:latest` and `:<sha>`.
- **`deploy-aet.yml`** — auto-runs after a successful image build on `main`; deploys the Helm chart to the AET Kubernetes cluster **by commit SHA** (immutable tag).
- **`deploy-azure.yml`** — manual-only (`workflow_dispatch`): Terraform `fmt`/`validate` then an Ansible Docker Compose deploy to an Azure VM (paused to save credits).

### AET Kubernetes (Helm)
The chart [`helm/calorieasy/`](helm/calorieasy/) deploys (release `app`) to namespace **`team-password123`**. A K8s **Ingress** routes to `web:80` — the web pod's nginx serves the SPA and reverse-proxies `/api/*` to the backends — with **cert-manager** TLS (cluster-issuer `letsencrypt-prod`, secret `team-password123-tls`). Ingress host: `team-password123-devops-ss26.stud.k8s.aet.cit.tum.de`. Images come from `ghcr.io/aet-devops26/team-password123/*`.

```bash
# pull secret for the private GHCR packages
kubectl create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io --docker-username=<user> --docker-password=<token> \
  -n team-password123

helm upgrade --install app helm/calorieasy \
  --namespace team-password123 \
  --set image.tag=<sha> \
  --set genai.openaiApiKey=<key>

# access via port-forward
kubectl port-forward -n team-password123 svc/web 8080:80
```

### Azure VM (manual, Docker Compose)
```bash
# 1. provision the VM (one-time, local)
cd infra/terraform
terraform init
terraform apply -var ssh_public_key="$(cat ~/.ssh/calorieasy_id.pub)"

# 2. configure + deploy
cd ../ansible
cp inventory.example.ini inventory.ini   # fill in the public IP
ansible-playbook -i inventory.ini playbook.yml \
  -e ghcr_user=... -e ghcr_token=... -e postgres_password=... -e jwt_secret=...
```
The prod Compose stack ([`docker-compose.prod.yml`](docker-compose.prod.yml)) pulls prebuilt GHCR images and serves the web client via nginx on `:80` (Postgres is not published externally). It is a simplified fallback environment — no monitoring stack or Weaviate, so insights run in degraded mode; the full observable deployment is the AET cluster. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full operator runbook, secrets, and variables.

> **Security note:** default secrets (`APP_JWT_SECRET`, `POSTGRES_PASSWORD`, Helm `jwt.secret`/`postgres.password`) are placeholders and must be overridden for any real deployment. The prod Compose stack enforces this via required (`:?`) variables.

## Roadmap

- [x] Three Spring Boot microservices (auth, meals, analytics) with schema-per-service isolation
- [x] Python FastAPI GenAI service (Gemini primary, OpenRouter Nemotron backup)
- [x] React web client — all pages (diary, scan, insights, profile, onboarding)
- [x] iOS SwiftUI client with backend sync (auth, meals, goals, GenAI analyze)
- [x] Docker Compose (dev + prod) — one-command local setup
- [x] GitHub Actions CI — build + test all services, Vitest, Playwright e2e, genai pytest
- [x] GHCR image build & push (5 images, immutable SHA tags)
- [x] Helm chart + Kubernetes deployment (AET cluster, ingress-nginx, TLS via cert-manager)
- [x] Terraform (Azure VM) + Ansible IaC
- [x] Prometheus + Grafana observability (metrics, dashboard, alert rules)
- [ ] Wire `APP_GENAI_BASE_URL` in dev Compose so photo scan hits genai locally (k8s already wired)
- [ ] iOS unit/UI test target
- [ ] Resilience4j circuit-breaker on analytics → meals call (Sprint 5 stretch)

## Observability

Prometheus + Grafana ship in both the docker-compose stack and the Helm chart.

**Metrics.** Each Spring service exposes Micrometer metrics at `/actuator/prometheus`; the GenAI service exposes `/metrics` (FastAPI instrumentator + custom `calorieasy_genai_analyze_*` counters/histogram). Prometheus scrapes all four every 15s ([`infra/monitoring/prometheus.yml`](infra/monitoring/prometheus.yml) for compose; a ConfigMap in [`helm/.../monitoring-prometheus.yaml`](helm/calorieasy/templates/monitoring-prometheus.yaml) for k8s — same targets).

**Dashboard.** A provisioned Grafana dashboard ([`helm/calorieasy/dashboards/calorieasy-overview.json`](helm/calorieasy/dashboards/calorieasy-overview.json)) covers request rate, error rate, p50/p95/p99 latency, JVM/GC/threads/CPU, HikariCP connections, error-level log events, and a **GenAI** row (analyses by result + analysis latency).

**Alerts.** [`helm/calorieasy/alerts.yml`](helm/calorieasy/alerts.yml) (one source of truth for both compose and the chart) defines: `ServiceDown` (`up==0` 2m), `HighRequestLatency` (p95 > 1s, 5m), `HighServerErrorRate` (>5% 5xx, 5m). Firing alerts show on Prometheus `/alerts`.

**Access.**

```bash
# Local (docker compose): Grafana on :3001, Prometheus on :9090
#   login: admin / $GRAFANA_ADMIN_PASSWORD (from .env)
open http://localhost:3001

# AET cluster: Grafana is served at https://<ingress-host>/grafana
```

## Docs

| Document | Description |
|----------|-------------|
| [API Reference](docs/API%20Reference.md) | Full endpoint docs — request/response bodies for all services |
| [System Architecture](docs/System%20Architecture.md) | Architecture diagram and service descriptions |
| [Sprint Plan](docs/sprint-plan.md) | Sprint history and upcoming work |
| [Problem Statement](docs/Problem%20Statement.md) | Product vision and user scenarios |
| [Deployment Guide](DEPLOYMENT.md) | K8s + Azure VM deployment instructions |
| [services/README.md](services/README.md) | Cross-cutting backend patterns (JWT, DB, inter-service calls) |
