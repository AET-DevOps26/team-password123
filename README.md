# Nutrition Tracker — Team password123

A nutrition and health companion that takes the friction out of food logging. Snap a photo of your meal, get calories and macros back, and review long-term trends in an analytics dashboard.

GenAI is the engine, not a bolted-on feature: a multi-modal LLM identifies foods from images, estimates portion sizes, and reasons about home-cooked meals that don't have a clean database match.

## Repository layout

| Path | What's there |
|------|--------------|
| [`services/auth-service/`](services/auth-service) | Identity, registration, login, JWT issuance. Port 8081, schema `auth`. |
| [`services/meals-service/`](services/meals-service) | Manual meal logging and photo placeholders. Port 8082, schema `meals`. |
| [`services/analytics-service/`](services/analytics-service) | Goals and daily/weekly aggregations. Port 8083, schema `analytics`. |
| [`ios-app/`](ios-app) | SwiftUI + SwiftData iOS client. Local-only prototype; networking layer will plug into the services. |
| [`docs/`](docs) | Problem statement, system architecture, and UML diagrams. |
| [`infra/postgres/`](infra/postgres) | Postgres init scripts (creates the per-service schemas). |
| [`api-service/`](api-service) | Legacy monolith — kept for reference until the new split is fully verified end-to-end. |

A Python + LangChain GenAI microservice is planned but not yet in the repo. Photo uploads currently land with `AI_NOT_AVAILABLE` status and can be converted into manual logs.

## Architecture

```
┌──────────────┐    JWT/REST    ┌─────────────────┐
│  iOS client  │ ─────────────▶ │  auth-service   │  issues JWT
│  (SwiftUI)   │                │  :8081          │
└──────────────┘                └────────┬────────┘
       │                                 │
       │ JWT/REST                        ▼
       │                        ┌─────────────────┐
       ├──────────────────────▶ │  meals-service  │
       │                        │  :8082          │
       │                        └────────┬────────┘
       │                                 │  REST (token forwarded)
       │                                 ▼
       │                        ┌─────────────────┐    ┌─────────────────┐
       └──────────────────────▶ │ analytics-svc   │    │  GenAI service  │
                                │  :8083          │    │  (Python, TBD)  │
                                └────────┬────────┘    └─────────────────┘
                                         │
                                         ▼
                                ┌─────────────────────────────┐
                                │   PostgreSQL                │
                                │   schemas: auth, meals,     │
                                │   analytics                 │
                                └─────────────────────────────┘
```

All three services validate JWTs using the same `APP_JWT_SECRET`. Only `auth-service` issues them. Each service owns its DB schema; cross-context reads happen via REST, not shared tables.

See [`docs/sys-architecture.png`](docs/sys-architecture.png) and [`docs/usecase-diagram.png`](docs/usecase-diagram.png) for the full diagrams.

## Quick start

**IMPORTANT: Ollama Requirement**

The GenAI service requires Ollama to run locally on your machine. Before starting docker-compose:

1. [Install Ollama](https://ollama.ai) for your OS
2. Run `ollama pull llava` to download the vision model (~4.7GB)
3. Start Ollama in the background (it will listen on `http://localhost:11434`)

Then:

```bash
cp .env.example .env
docker compose up --build
```

Postgres + all services (including genai-service) come up in one shot. Each service exposes its own Swagger UI:

- Auth: <http://localhost:8081/swagger-ui.html>
- Meals: <http://localhost:8082/swagger-ui.html>
- Analytics: <http://localhost:8083/swagger-ui.html>
- GenAI: <http://localhost:8084/docs> (FastAPI Swagger)

Per-service details are in [`services/README.md`](services/README.md) and the individual service READMEs.

### iOS app

Open the project in Xcode 15+ targeting iOS 17. Setup steps and the SwiftData model are documented in [`ios-app/README.md`](ios-app/README.md). The app runs fully offline today — no API or backend required to try it.

## Status

- [x] Server side split into 3 microservices (auth, meals, analytics) with shared-secret JWT and per-schema isolation
- [x] Root `docker-compose.yml` brings up Postgres + all 3 services in one command
- [x] iOS prototype: local SwiftData persistence, manual + photo logging, daily progress, weekly charts
- [x] GenAI microservice for food recognition and nutritional inference (Python + FastAPI + Ollama/OpenAI)
- [ ] Web client (React/Angular/Vue) per the course requirements
- [ ] GitHub Actions CI/CD
- [ ] Kubernetes manifests / Helm charts (Rancher + Azure)
- [ ] Prometheus + Grafana with exported dashboards and alert rules
- [ ] iOS networking layer wired to the services
- [ ] Retire the legacy `api-service/` monolith

## Intended users

- Health-conscious individuals who abandon traditional trackers due to data-entry fatigue
- Athletes monitoring specific macronutrient targets
- Anyone managing weight who wants to see caloric trends over weeks and months

## Documentation

- [Problem statement](docs/Problem%20Statement.md)
- [System architecture](docs/System%20Architecture.md)
- Services overview: [`services/README.md`](services/README.md)
- Backlog: [Miro board](https://miro.com/app/board/uXjVHdWuFjk=/)
