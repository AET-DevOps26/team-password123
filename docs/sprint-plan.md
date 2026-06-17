# Sprint Plan — Calorieasy (team-password123)

> Course: AET DevOps SS26 · Team: Deniz, Melisa, Pavel

---

## Sprint 1 — Project Setup & Architecture
**Dates:** 04/05/26 – 15/05/26 (Weeks 1–2)

**Goal:** Establish the project foundation, agree on architecture, and get a working backend skeleton.

**Delivered:**
- Repository structure defined (frontend, backend services, iOS app, docs)
- Problem Statement and System Architecture documents written
- Initial Spring Boot backend implemented (monolith prototype)
- Microservices refactoring: split into auth-service (8081), meals-service (8082), analytics-service (8083) with schema-per-service PostgreSQL isolation
- Docker Compose for local development
- Weekly report templates added

**Team assignments:**
- Deniz: Architecture decisions, microservices refactoring, repo setup
- Melisa: Docs (Problem Statement, System Architecture), microservices review
- Pavel: Frontend architecture research (FSD, Vite, Zustand)

---

## Sprint 2 — Core Services & Frontend
**Dates:** 18/05/26 – 29/05/26 (Weeks 3–4)

**Goal:** Build the GenAI service, iOS prototype, and the full React web client.

**Delivered:**
- GenAI service (Python FastAPI): multi-provider vision analysis via Ollama / OpenAI / Gemini, local nutrition_db.json cache, pytest test suite
- iOS SwiftUI prototype: fully offline, SwiftData persistence, all screens (Today, Log, Analytics, History, Profile), home screen widget
- React web frontend (Vite + TypeScript + FSD): all pages implemented — auth, onboarding, diary, photo scan, insights, profile
- Zustand state management, API client, centralized mock mode for frontend dev
- Flyway DB migrations per service

**Team assignments:**
- Deniz: iOS SwiftUI prototype (all screens + widget)
- Melisa: GenAI service implementation, nutrition data pipeline, tests
- Pavel: Full React frontend — FSD migration, all pages, mock mode

---

## Sprint 3 — Integration & CI/CD
**Dates:** 01/06/26 – 12/06/26 (Weeks 5–6)

**Goal:** Wire everything together, ship automated CI, deploy to cloud.

**Delivered:**
- GitHub Actions CI: Java matrix build + JUnit tests, Vitest frontend build + tests, Playwright e2e job
- Unit tests for all three Java services (9 test classes)
- Missing backend endpoints: profile update, photo analysis, streak calculation
- Full-stack Docker Compose (all 5 services + React dev server)
- Demo data seed script
- Helm chart for Kubernetes deployment (AET cluster) with in-namespace Traefik LB and TLS via cert-manager
- GitHub Actions image build workflow (5 GHCR images, SHA-tagged)
- GitHub Actions deploy workflow (Helm → AET K8s, immutable SHA tags)
- Terraform (Azure VM) + Ansible (Docker Compose deploy) IaC
- Azure deploy workflow (manual)
- Photo scan → GenAI → meals-service wiring (end-to-end)
- Playwright e2e tests: auth and onboarding specs

**Team assignments:**
- Deniz: Helm chart, Traefik, TLS, Azure IaC, deploy workflows, photo scan wiring
- Melisa: GitHub Actions CI, all unit tests, missing backend endpoints, compose integration, seed script
- Pavel: Real API wiring, navigation bug fixes, Playwright init + first specs

---

## Sprint 4 — Testing & Hardening
**Dates:** 15/06/26 – 26/06/26 (Weeks 7–8)

**Goal:** Complete e2e test coverage, add observability, stabilise CI.

**Delivered / In progress:**
- Playwright e2e tests: scan-meal, diary, insights, profile specs
- All e2e tests deployed to CI with HTML report artefact
- Integration tests PR (#68) merged
- Prometheus metrics endpoint on all Spring Boot services (`micrometer-registry-prometheus`)
- Basic Grafana dashboard (HTTP request rate + JVM memory)
- Genai pytest added to CI
- README cleanup (stale status items fixed, outdated api-service references removed)

**Team assignments:**
- Deniz: Observability setup (Prometheus + Grafana), CI stabilisation, K8s validation
- Melisa: Genai pytest CI job, README and docs cleanup, backend hardening
- Pavel: Remaining Playwright specs (scan, diary, insights, profile)

---

## Sprint 5 — Polish & Presentation
**Dates:** 29/06/26 – 10/07/26 (Weeks 9–10)

**Goal:** Final documentation, demo preparation, and project submission.

**Planned:**
- Architecture diagrams committed to repo (C4 context diagram or updated UML PNGs)
- iOS app networking: connect SwiftUI client to live REST API (auth + meals + analytics)
- Confidence indicator on GenAI analysis result in the UI
- Circuit-breaker on analytics → meals REST call (Resilience4j)
- Final demo flow rehearsal and presentation materials
- Repository clean-up and final README update
- Project submission

**Team assignments:**
- Deniz: iOS API networking, circuit-breaker, final architecture diagram, presentation
- Melisa: Final test coverage pass, architecture ADRs, presentation support
- Pavel: UI polish (confidence indicator, GenAI result edit flow), final presentation demo
