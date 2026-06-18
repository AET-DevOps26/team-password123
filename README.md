# Calorieasy — Team password123

A nutrition and health companion that removes the friction from food logging. Snap a photo of a meal, get calories and macros back instantly via GenAI, and track long-term trends in an analytics dashboard.

## Repository layout

| Path | What's there |
|------|--------------|
| [`calorie-app/`](calorie-app) | React + TypeScript web client (Vite, Feature-Sliced Design). Port 3000. |
| [`services/auth-service/`](services/auth-service) | Identity, registration, login, JWT issuance. Port 8081, schema `auth`. |
| [`services/meals-service/`](services/meals-service) | Manual meal logging + photo scan with GenAI analysis. Port 8082, schema `meals`. |
| [`services/analytics-service/`](services/analytics-service) | Goals and daily/weekly aggregations. Port 8083, schema `analytics`. |
| [`services/genai-service/`](services/genai-service) | Python FastAPI vision service (Gemini in prod, Ollama local). Port 8084. |
| [`ios-app/`](ios-app) | SwiftUI + SwiftData iOS prototype (offline, networking planned). |
| [`helm/calorieasy/`](helm/calorieasy) | Kubernetes Helm chart for AET cluster deployment. |
| [`infra/`](infra) | Terraform (Azure VM) + Ansible (Docker Compose deploy). |
| [`docs/`](docs) | Problem statement, system architecture, API reference, sprint plan. |

## Architecture

```
┌─────────────────┐   JWT/REST   ┌──────────────────┐
│  React web app  │─────────────▶│  auth-service    │  issues JWT
│  :3000          │              │  :8081           │
└─────────────────┘              └──────────────────┘
        │                                 │
        │ JWT/REST                        │
        ▼                                 ▼
┌─────────────────┐              ┌──────────────────┐
│  iOS SwiftUI    │              │  meals-service   │──▶ genai-service :8084
│  (offline now)  │              │  :8082           │    (Gemini vision AI)
└─────────────────┘              └────────┬─────────┘
                                          │ REST (token forwarded)
                                          ▼
                                 ┌──────────────────┐
                                 │analytics-service │
                                 │  :8083           │
                                 └────────┬─────────┘
                                          │
                                          ▼
                                 ┌──────────────────────────┐
                                 │  PostgreSQL 16            │
                                 │  schemas: auth / meals /  │
                                 │  analytics                │
                                 └──────────────────────────┘
```

All three Java services validate JWTs using the same `APP_JWT_SECRET`. Only `auth-service` issues them. Each service owns its DB schema; cross-service reads go via REST.

## Quick start (local)

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) and [Ollama](https://ollama.ai) installed.

```bash
# 1. Pull the vision model for local GenAI (first time only, ~4.7 GB)
ollama pull llava

# 2. Copy env template and start everything
cp .env.example .env
docker compose up --build
```

App opens at **http://localhost:3000**. All five services + Postgres come up in one command.

To pre-populate demo data for the last two weeks:
```powershell
.\scripts\seed-demo-data.ps1
```

### Swagger UI (local)

| Service | URL |
|---------|-----|
| Auth | http://localhost:8081/swagger-ui.html |
| Meals | http://localhost:8082/swagger-ui.html |
| Analytics | http://localhost:8083/swagger-ui.html |
| GenAI | http://localhost:8084/docs |

### Production (AET Kubernetes)

Live at **https://team-password123-devops-ss26.stud.k8s.aet.cit.tum.de**

Deployed automatically on every push to `main` via Helm. GenAI uses Google Gemini in production (no Ollama required).

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full deployment guide.

## Status

- [x] Three Spring Boot microservices (auth, meals, analytics) with schema-per-service isolation
- [x] Python FastAPI GenAI service (Ollama local / Gemini cloud)
- [x] React web client — all pages (diary, scan, insights, profile, onboarding)
- [x] iOS SwiftUI prototype (offline, SwiftData)
- [x] Docker Compose (dev + prod) — one-command local setup
- [x] GitHub Actions CI — build + test all services, Vitest, Playwright e2e, genai pytest
- [x] GHCR image build & push (5 images, immutable SHA tags)
- [x] Helm chart + Kubernetes deployment (AET cluster, Traefik, TLS via cert-manager)
- [x] Terraform (Azure VM) + Ansible IaC
- [ ] Prometheus + Grafana observability
- [ ] iOS networking layer wired to the services

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](docs/API%20Reference.md) | Full endpoint docs — request/response bodies for all services |
| [System Architecture](docs/System%20Architecture.md) | Architecture diagram and service descriptions |
| [Sprint Plan](docs/sprint-plan.md) | Sprint history and upcoming work |
| [Problem Statement](docs/Problem%20Statement.md) | Product vision and user scenarios |
| [Deployment Guide](DEPLOYMENT.md) | K8s + Azure VM deployment instructions |
| [services/README.md](services/README.md) | Cross-cutting backend patterns (JWT, DB, inter-service calls) |
