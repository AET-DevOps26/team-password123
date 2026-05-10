# Nutrition Tracker — Team password123

A nutrition and health companion that takes the friction out of food logging. Snap a photo of your meal, get calories and macros back, and review long-term trends in an analytics dashboard.

GenAI is the engine, not a bolted-on feature: a multi-modal LLM identifies foods from images, estimates portion sizes, and reasons about home-cooked meals that don't have a clean database match.

## Repository layout

| Path | What's there |
|------|--------------|
| [`api-service/`](api-service) | Spring Boot REST API (Java 21, PostgreSQL, JWT). Handles auth, meal logging, goals, and analytics. |
| [`ios-app/`](ios-app) | SwiftUI + SwiftData iOS client. Local-only prototype today; networking layer will plug into the API. |
| [`docs/`](docs) | Problem statement, system architecture, and UML diagrams (use case, class, top-level architecture). |

A Python + LangChain GenAI microservice is planned per [`docs/System Architecture.md`](docs/System%20Architecture.md) but not yet in the repo. Photo uploads currently land with `AI_NOT_AVAILABLE` status and can be converted into manual logs.

## Architecture

```
┌──────────────┐      JWT/REST       ┌───────────────────┐      HTTP      ┌─────────────────┐
│  iOS client  │ ──────────────────▶ │  Spring Boot API  │ ─────────────▶ │  GenAI service  │
│ (SwiftUI)    │                     │  (Java 21)        │                │  (Python, TBD)  │
└──────────────┘                     └─────────┬─────────┘                └─────────────────┘
                                               │
                                               ▼
                                       ┌──────────────┐
                                       │  PostgreSQL  │
                                       └──────────────┘
```

See [`docs/sys-architecture.png`](docs/sys-architecture.png) and [`docs/usecase-diagram.png`](docs/usecase-diagram.png) for the full diagrams.

## Quick start

### API service

```bash
cd api-service
cp .env.example .env          # set JWT secret + DB creds
docker compose up -d          # PostgreSQL
mvn spring-boot:run
```

Swagger UI: <http://localhost:8080/swagger-ui.html>. See [`api-service/README.md`](api-service/README.md) for the endpoint catalog.

### iOS app

Open the project in Xcode 15+ targeting iOS 17. Setup steps and the SwiftData model are documented in [`ios-app/README.md`](ios-app/README.md). The app runs fully offline today — no API or backend required to try it.

## Status

- [x] Spring Boot API: auth, goals, manual meals, photo placeholders, daily/weekly analytics
- [x] iOS prototype: local SwiftData persistence, manual + photo logging, daily progress, weekly charts
- [ ] GenAI microservice for food recognition and nutritional inference
- [ ] iOS networking layer wired to the API (auth, meals, analytics clients)
- [ ] Offline cache reconciliation between SwiftData and the API

## Intended users

- Health-conscious individuals who abandon traditional trackers due to data-entry fatigue
- Athletes monitoring specific macronutrient targets
- Anyone managing weight who wants to see caloric trends over weeks and months

## Documentation

- [Problem statement](docs/Problem%20Statement.md)
- [System architecture](docs/System%20Architecture.md)
- Backlog: [Miro board](https://miro.com/app/board/uXjVHdWuFjk=/)
