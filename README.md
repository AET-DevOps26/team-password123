# Calorieasy

Calorieasy is a photo-based nutrition and calorie tracker built as a university DevOps course project (org **AET-DevOps26**, repo **team-password123**). The core flow: snap a photo of a meal, a GenAI service identifies the foods and portions and estimates calories + macros, and the web and iOS clients show a daily diary plus weekly/monthly analytics. The backend is a set of Spring Boot microservices (auth, meals, analytics) plus a Python FastAPI GenAI service, all behind a single PostgreSQL instance with per-service schemas.

## What it does

- **Photo → nutrition.** Upload a meal photo; the GenAI service (vision LLM) returns identified foods, calories, and macros (protein/carbs/fat/fiber) with a confidence score.
- **Manual logging.** Add meals and macros by hand; edit and delete entries.
- **Diary.** Per-day food log with day-to-day navigation.
- **Analytics.** Daily and weekly aggregates with goal deltas and a logging streak.
- **Goals.** Per-user nutrition goals (calories + macros), with Mifflin–St Jeor TDEE suggestions in onboarding.
- **Auth.** Email/password registration and login with JWT; one shared signing secret validated by every service.
- **iOS prototype.** A local-only SwiftUI + SwiftData app (manual logging, water tracking, Swift Charts analytics, and a home-screen widget).

## Repository layout

| Path | What it is |
|------|------------|
| [`calorie-app/`](calorie-app/) | React 18 + TypeScript web client (Vite, Zustand, CSS Modules, Feature-Sliced Design) |
| [`services/auth-service/`](services/auth-service/) | Spring Boot identity service: registration, login, JWT issuance, user profiles (`:8081`, schema `auth`) |
| [`services/meals-service/`](services/meals-service/) | Spring Boot meals service: manual logging, photo upload, AI analysis (`:8082`, schema `meals`) |
| [`services/analytics-service/`](services/analytics-service/) | Spring Boot analytics service: goals + daily/weekly aggregates + streak (`:8083`, schema `analytics`) |
| [`services/genai-service/`](services/genai-service/) | Python FastAPI GenAI service: meal image → calories/macros (`:8084`) |
| [`ios-app/`](ios-app/) | SwiftUI + SwiftData iOS client (local-only prototype) |
| [`infra/`](infra/) | Postgres init SQL, Terraform (Azure VM), Ansible |
| [`helm/calorieasy/`](helm/calorieasy/) | Helm chart for the AET Kubernetes cluster |
| [`docs/`](docs/) | Problem statement, system architecture, and UML diagrams |
| [`.github/workflows/`](.github/workflows/) | CI + image build + AET k8s deploy + manual Azure deploy |
| [`docker-compose.yml`](docker-compose.yml) / [`docker-compose.prod.yml`](docker-compose.prod.yml) | Dev (build locally) / prod (pull GHCR images) stacks |

## Architecture

A single-page web client and an iOS client talk to three Spring Boot REST microservices behind one PostgreSQL instance (one database, three schemas). The meals service can delegate image recognition to the Python GenAI service. **Only `auth-service` issues JWTs**; meals and analytics validate them with the same shared `APP_JWT_SECRET`. `analytics-service` is a read-side aggregator — it does not store meals; it fetches them live from `meals-service` over HTTP, forwarding the caller's bearer token.

```
                         ┌──────────────────────────────────────────────┐
   Web client (SPA)      │  Reverse proxy (/api/*)                       │
   Vite dev :3000        │  · dev:  Vite proxy (per-service)             │
   nginx prod :80   ───► │  · prod: nginx / k8s Traefik                  │
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
             │                │  LLM (Ollama/     │                  │
             │                │  OpenAI/Gemini)   │                  │
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
| Vision LLMs | Ollama (`llava`, default in dev), OpenAI (`gpt-4o`), Google Gemini (via OpenAI-compatible endpoint) |
| Nutrition data | USDA FoodData Central with a local `nutrition_db.json` cache fallback |
| iOS | Swift 5, SwiftUI, SwiftData, WidgetKit, Swift Charts (xcodegen project) |
| API docs | springdoc-openapi (Swagger UI) per Spring service; FastAPI `/docs` for GenAI |
| Infra / CI | Docker Compose, Helm v3, Kubernetes (AET cluster), Terraform + Ansible (Azure VM), GitHub Actions, GHCR |

## Quick start (Docker Compose)

Brings up Postgres + the three Spring services + the GenAI service + the web client (Vite dev server) on one machine.

### Prerequisites
- Docker + Docker Compose v2
- For the **default GenAI provider (Ollama)**: a local [Ollama](https://ollama.com) running on `:11434` with the `llava` vision model pulled (`ollama pull llava`). The dev compose points the GenAI service at `host.docker.internal:11434`. Without Ollama, photo analysis degrades but the rest of the stack runs.

> The dev Compose stack does **not** wire `meals-service` to `genai-service` (no `APP_GENAI_BASE_URL`), so under Compose photo analysis uses a deterministic placeholder analyzer rather than the real GenAI link. The GenAI service still runs and is reachable directly on `:8084`. The GenAI link is wired only in the Helm/k8s path.

### Run
```bash
cp .env.example .env
docker compose up --build
```

Topology once up:

| Service | URL |
|---------|-----|
| Web client (Vite dev) | http://localhost:3000 |
| auth-service | http://localhost:8081 (Swagger: `/swagger-ui.html`) |
| meals-service | http://localhost:8082 (Swagger: `/swagger-ui.html`) |
| analytics-service | http://localhost:8083 (Swagger: `/swagger-ui.html`) |
| genai-service | http://localhost:8084 (Swagger: `/docs`) |
| PostgreSQL | localhost:5432 (DB `nutrition`) |

### Seed demo data (optional)
With the dev stack running:
```bash
pwsh scripts/seed-demo-data.ps1
```
Inserts a demo user plus 14 days of meals and goals directly into the Postgres tables (Windows PowerShell oriented; assumes `docker compose exec postgres`).

## Local development (per component)

### Web client — `calorie-app/`
```bash
cd calorie-app
npm install
npm run dev        # Vite dev server on http://localhost:3000 (host 0.0.0.0)
npm run build      # tsc && vite build → dist/
npm run preview    # serve the built output
```
For backend-free local dev, create `calorie-app/.env.local` with `VITE_MOCK_MODE=true` (it is gitignored and **not** committed). The client calls the backend under the `/api` prefix; the Vite dev proxy routes per service: `/api/auth` & `/api/users` → `:8081`, `/api/meals` → `:8082`, `/api/analytics` & `/api/goals` → `:8083`.

> `react-router-dom` is a declared dependency but unused — routing is a local `useState` page union in `App.tsx`.

### Spring services — `services/{auth,meals,analytics}-service/`
Each service is an independent Maven module (no Maven wrapper; use a system `mvn`). They need Postgres reachable with their schema, and `APP_JWT_SECRET` must match across services.
```bash
cd services/auth-service        # or meals-service / analytics-service
mvn test                        # run unit tests
mvn package                     # build the jar
mvn spring-boot:run             # run locally (auth :8081, meals :8082, analytics :8083)
```
Single-service Docker build:
```bash
docker build -t auth-service services/auth-service
docker run -p 8081:8081 auth-service
```

### GenAI service — `services/genai-service/`
```bash
cd services/genai-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
ollama pull llava                       # default provider; Ollama on :11434
uvicorn app:app --reload --port 8084    # Swagger at http://localhost:8084/docs

# smoke-test a running instance:
curl -X POST http://localhost:8084/api/analyze -F "file=@/path/to/meal.jpg"
```
Provider is selected with `LLM_PROVIDER` (`ollama` | `openai` | `google`); see [Configuration](#configuration).

### iOS app — `ios-app/`
Local-only prototype (no networking, auth, or GenAI; all data is on-device SwiftData). Requires macOS + Xcode 15+ (iOS 17 SDK) and `xcodegen`.
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
| `GET` | `/api/users/{id}` | Lookup user by UUID |
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
| `POST` | `/api/meals/analyze` | Multipart `image`; runs the analyzer; `source=PHOTO_AI` |
| `GET` | `/api/meals/photo/{id}/raw` | Stream stored photo bytes (owner only) |

> `POST /api/meals/photo` only stores the file and never triggers AI. Image analysis happens only via `POST /api/meals/analyze`. When `app.genai.base-url` is set, that endpoint calls the GenAI service at `POST /api/analyze`; otherwise it uses a deterministic, non-AI placeholder analyzer. Multipart upload limit is 10 MB.

### analytics-service (`:8083`)
| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/analytics/daily?date=YYYY-MM-DD` | Daily totals + per-macro goal deltas |
| `GET` | `/api/analytics/weekly?weekStart=YYYY-MM-DD` | 7-day totals + deltas vs. (daily goal × 7) |
| `GET` | `/api/analytics/streak` | Consecutive-days logging streak (~5-year window) |
| `GET` | `/api/goals` | Current user's goal, or `204` if none set |
| `PUT` | `/api/goals` | Upsert nutrition goal (`GoalRequest`; includes `fiberGrams`) |

Goal deltas are `actual − target`; with no goal set, target is treated as 0. If `meals-service` is down, analytics returns `502`.

### genai-service (`:8084`)
| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/health` | Readiness (`ok` / `degraded`) |
| `POST` | `/api/analyze` | Multipart `file` → `NutritionResponse` (foods, calories, protein/carbs/fat/fiber grams, confidence) |
| `POST` | `/api/analyze/base64` | JSON `{ "image": "<base64>" }` → `NutritionResponse` |
| `POST` | `/api/analyze/compare` | Run two providers and compare calorie estimates |

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
| `LLM_PROVIDER` | `ollama` | `ollama` \| `openai` \| `google` |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | `http://localhost:11434` / `llava` | Ollama config |
| `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_BASE_URL` | _empty_ / `gpt-4o` / _empty_ | OpenAI (or OpenAI-compatible, e.g. Gemini) config |
| `GOOGLE_API_KEY` / `GOOGLE_MODEL` | _empty_ / `gemini-2.0-flash` | Native Google path |
| `NUTRITION_DATA_PROVIDER` | `usda` | `auto` \| `usda` \| `local` |
| `USDA_FDC_API_KEY` | _empty_ | Without it, USDA lookups are skipped and only the local cache is used |
| `PORT` / `DEBUG` | `8084` / `false` | Server port / debug logging |

**GenAI provider by environment.** The default differs across deployments:
- **Code / dev Compose** → `ollama` with `llava` (`host.docker.internal:11434`).
- **Prod Compose** → `openai` with `gpt-4o`, `NUTRITION_DATA_PROVIDER=local`.
- **Helm / AET k8s** → `openai` pointed at Google's Gemini OpenAI-compatible endpoint (`https://generativelanguage.googleapis.com/v1beta/openai/`, model `gemini-3.1-flash-lite`); the AET deploy workflow further overrides the base URL, model, and key with `LOGOS_*` secrets at deploy time.

Gemini is reached via `LLM_PROVIDER=openai` plus a Gemini OpenAI-compatible `OPENAI_BASE_URL`, not the native `google` path.

### Web client
[`calorie-app/.env.example`](calorie-app/.env.example) holds the committed defaults; copy it to `calorie-app/.env.local` (gitignored) to override locally.

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_MOCK_MODE` | `false` | Seeded mock data, no backend needed |
| `VITE_OFFLINE_MODE` | `false` | All API calls return typed empty responses, no network |
| `VITE_API_URL` | `http://localhost:8081` | Legacy base URL — unused; the Vite dev proxy handles routing |
| `VITE_AUTH_API_URL` / `VITE_MEALS_API_URL` / `VITE_ANALYTICS_API_URL` | `:8081` / `:8082` / `:8083` | Per-service dev proxy targets, read by `vite.config.ts` (not in `.env.example`) |

## Testing

| Component | Command | Coverage |
|-----------|---------|----------|
| Web client | `cd calorie-app && npm test` | Vitest, 31 unit tests (pure functions: `calculateGoals`, mappers). No DOM/component tests. |
| auth-service | `cd services/auth-service && mvn test` | JUnit 5 + Mockito, unit-only (JwtService, AuthService, UserService) |
| meals-service | `cd services/meals-service && mvn test` | JUnit 5 + Mockito, unit-only (MealService, MealMapper, GenAiMealAnalyzer mapping) |
| analytics-service | `cd services/analytics-service && mvn test` | JUnit 5 + Mockito, unit-only (AnalyticsService, GoalService) |
| genai-service (unit) | `cd services/genai-service && pytest tests/test_nutrition_lookup.py -v` | Pure unit tests, no running server |
| genai-service (smoke) | `pytest tests/test_smoke.py -v` | HTTP smoke tests against a running service (auto-skips if down) |
| iOS app | — | No tests (the xcodegen project defines no test target) |

Backend tests are unit-only (mocked collaborators, no Spring context / DB). There are no `@SpringBootTest`/`@WebMvcTest` integration tests.

## Deployment & CI/CD

Four GitHub Actions workflows in [`.github/workflows/`](.github/workflows/):

- **`ci.yml`** — on every PR and push to `main`: a 3-way backend matrix runs `mvn -B -ntp verify` (JDK 21 temurin) for auth/meals/analytics, and the frontend job runs `npm ci`, `npm run build` (strict `tsc` + Vite build), and `npm test` (Node 20).
- **`build-images.yml`** — on push to `main` (or manual dispatch): builds five `linux/amd64` images (auth-service, meals-service, analytics-service, genai-service, web) and pushes them to GHCR tagged `:latest` and `:<sha>`.
- **`deploy-aet.yml`** — auto-runs after a successful image build on `main`; deploys the Helm chart to the AET Kubernetes cluster **by commit SHA** (immutable tag).
- **`deploy-azure.yml`** — manual-only (`workflow_dispatch`): Terraform `fmt`/`validate` then an Ansible Docker Compose deploy to an Azure VM (paused to save credits).

### AET Kubernetes (Helm)
The chart [`helm/calorieasy/`](helm/calorieasy/) deploys (release `app`) to namespace **`team-password123`**. It ships an in-namespace **Traefik** router for `/api/*` path routing and a K8s **Ingress** to `web:80` with **cert-manager** TLS (cluster-issuer `letsencrypt-prod`, secret `team-password123-tls`). Ingress host: `team-password123-devops-ss26.stud.k8s.aet.cit.tum.de`. Images come from `ghcr.io/aet-devops26/team-password123/*`.

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
kubectl port-forward -n team-password123 svc/traefik 8080:80
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
The prod Compose stack ([`docker-compose.prod.yml`](docker-compose.prod.yml)) pulls prebuilt GHCR images and serves the web client via nginx on `:80` (Postgres is not published externally). See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full operator runbook, secrets, and variables.

> **Security note:** default secrets (`APP_JWT_SECRET`, `POSTGRES_PASSWORD`, Helm `jwt.secret`/`postgres.password`) are placeholders and must be overridden for any real deployment. The prod Compose stack enforces this via required (`:?`) variables.

## Docs

Product and design material lives in [`docs/`](docs/):
- [`Problem Statement.md`](docs/Problem%20Statement.md) — product vision and functional scenarios.
- [`System Architecture.md`](docs/System%20Architecture.md) — initial system structure (predates the three-service split).
- UML diagrams: `usecase-diagram.png`, `sys-architecture.png`, `object-diagram.png`.
</content>
