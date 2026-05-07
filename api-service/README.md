# Nutrition API

Spring Boot API for a nutrition and health companion. The service supports JWT-secured user accounts, nutrition goals, manual meal logging, photo-log placeholders, and calorie/macro analytics.

GenAI food recognition is intentionally deferred in this version. Photo uploads are stored as placeholders with `AI_NOT_AVAILABLE` status and can be converted into manual meal logs.

## Stack

- Java 21
- Spring Boot 3.5.x
- Maven
- PostgreSQL
- Flyway
- Spring Security + JWT
- Spring Data JPA
- Swagger/OpenAPI

## Local Run

```powershell
cd api-service
docker compose up -d
mvn spring-boot:run
```

Swagger UI is available at:

```text
http://localhost:8080/swagger-ui.html
```

## Key Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/goals`
- `PUT /api/goals`
- `POST /api/meals/manual`
- `GET /api/meals?from=2026-05-01&to=2026-05-07`
- `POST /api/meals/photo`
- `POST /api/meals/photo/{id}/convert-manual`
- `GET /api/analytics/daily?date=2026-05-07`
- `GET /api/analytics/weekly?weekStart=2026-05-04`

Use the bearer token returned from login for protected endpoints.
