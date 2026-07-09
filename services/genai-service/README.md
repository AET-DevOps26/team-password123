# GenAI Service

Multi-modal LLM-powered food image recognition and nutritional inference microservice.

- **Port**: 8084
- **Framework**: FastAPI (Python)
- **Production LLM**: Google Gemini (`gemini-3.1-flash-lite`) via its OpenAI-compatible endpoint
- **Backup LLM**: OpenRouter Nemotron (`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`)
- **Text LLM**: AET Logos `gpt-oss-120b` for food-name estimation and RAG health insights
- **Nutrition data**: Local `nutrition_db.json` cache (production); USDA FoodData Central optional (dev)

## How it works

1. Receive a food image (multipart upload or base64 JSON)
2. Send it to the configured vision LLM with a structured JSON prompt
3. LLM returns a list of detected foods with estimated gram weights
4. Look up per-100g macro values for each food (USDA API or local cache)
5. Calculate totals: `(grams / 100) × macros_per_100g`
6. Return `NutritionResponse` with calories, protein, carbs, fat, fiber, confidence

## Endpoints

| Method | Path | Input | Output |
|--------|------|-------|--------|
| GET | `/health` | — | `{"status": "ok", "analyzer_ready": true}` |
| POST | `/api/analyze` | multipart image file | `NutritionResponse` |
| POST | `/api/analyze/base64` | `{"image": "<base64>"}` | `NutritionResponse` |
| POST | `/api/analyze/compare` | multipart image file | `NutritionComparisonResponse` |
| POST | `/api/estimate` | JSON `{ "foodName": "..." }` | `FoodEstimateResponse` (per-100g macros) |
| POST | `/api/insight` | JSON eating profile | `InsightResponse` (RAG health insight) |

**Response shape (`NutritionResponse`):**
```json
{
  "foods": ["grilled chicken", "broccoli"],
  "calories": 350.0,
  "protein_grams": 45.0,
  "carbs_grams": 12.0,
  "fat_grams": 9.0,
  "fiber_grams": 4.5,
  "confidence": 0.87
}
```

Full request/response docs: [`docs/API Reference.md`](../../docs/API%20Reference.md)

## Production configuration

Production (Helm chart) routes through Google Gemini's OpenAI-compatible endpoint and keeps
OpenRouter Nemotron as automatic fallback for quota or rate-limit failures:

```
LLM_PROVIDER=openai
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
OPENAI_MODEL=gemini-3.1-flash-lite
OPENAI_API_KEY=<Google AI Studio key>          # GitHub secret: GEMINI_API_KEY
BACKUP_OPENAI_BASE_URL=https://openrouter.ai/api/v1
BACKUP_OPENAI_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
BACKUP_OPENAI_API_KEY=<OpenRouter key>         # GitHub secret: OPENROUTER_API_KEY
TEXT_OPENAI_BASE_URL=https://logos.aet.cit.tum.de/v1
TEXT_OPENAI_MODEL=openai/gpt-oss-120b
TEXT_OPENAI_API_KEY=<Logos key>                # GitHub secret: LOGOS_API_KEY
NUTRITION_DATA_PROVIDER=local
```

Primary and backup vision paths use LangChain `ChatOpenAI`. Text estimation and RAG insights use a separate text LLM (Logos).

## Local development

### Option A — Gemini + OpenRouter Nemotron backup

```bash
export LLM_PROVIDER=openai
export OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
export OPENAI_MODEL=gemini-3.1-flash-lite
export OPENAI_API_KEY=<your Google AI Studio key>
export BACKUP_OPENAI_BASE_URL=https://openrouter.ai/api/v1
export BACKUP_OPENAI_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
export BACKUP_OPENAI_API_KEY=<your OpenRouter key>
export NUTRITION_DATA_PROVIDER=local

# Run
cd services/genai-service
pip install -r requirements.txt
uvicorn app:app --reload --port 8084
```

### Option B — Gemini only

```bash
export LLM_PROVIDER=openai
export OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
export OPENAI_MODEL=gemini-3.1-flash-lite
export OPENAI_API_KEY=<your Google AI Studio key>
export NUTRITION_DATA_PROVIDER=local
uvicorn app:app --reload --port 8084
```

Get a free API key at [aistudio.google.com](https://aistudio.google.com/apikey).

### Docker Compose

The service is included in the root `docker-compose.yml`. Set `LLM_PROVIDER`, `OPENAI_BASE_URL`, `OPENAI_API_KEY`, and the backup `BACKUP_OPENAI_*` values in your `.env` file and run:

```bash
docker compose up --build
```

Visit **http://localhost:8084/docs** for interactive Swagger UI.

## Testing

```bash
cd services/genai-service

# Unit tests (no service or API key needed — runs in CI)
pytest tests/test_unit.py tests/test_nutrition_lookup.py -v

# Smoke tests (requires running service on localhost:8084)
pytest tests/test_smoke.py -v

# Image expectation tests (requires running service + test-images/ directory)
pytest tests/test_image_expectations.py -v

# Gemini integration tests (requires GOOGLE_API_KEY env var)
export GOOGLE_API_KEY=your-key
pytest tests/test_genai_integration.py -v -m integration

# Nemotron backup integration tests (requires OPENROUTER_API_KEY or BACKUP_OPENAI_API_KEY)
pytest tests/test_nemotron_integration.py -v -m integration
```

| Test file | Needs service? | Needs API key? | Runs in CI? |
|-----------|---------------|----------------|-------------|
| `test_unit.py` | No | No | Yes |
| `test_nutrition_lookup.py` | No | No | Yes |
| `test_smoke.py` | Yes (localhost:8084) | No | No |
| `test_image_expectations.py` | Yes (localhost:8084) | No | No |
| `test_genai_integration.py` | No | Yes (GOOGLE_API_KEY) | No (skip if no key) |
| `test_nemotron_integration.py` | No | Yes (OPENROUTER_API_KEY) | Skips without key; runs when secret set |

## Troubleshooting

**"NutritionAnalyzer not initialized"** — Check that the LLM provider env vars are set correctly. Check service logs for the exact initialization error.

**"Image analysis failed"** — Ensure the image is valid (JPG, PNG, WEBP) and not empty. Check rate limits on the LLM provider.

**Slow responses** — Vision LLM calls typically take 2–8 seconds. Gemini free tier may add latency under load.

**Backup model unavailable** — Make sure the OpenAI-compatible backup endpoint is reachable and the model name is correct.
