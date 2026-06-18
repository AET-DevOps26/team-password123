# GenAI Service

Multi-modal LLM-powered food image recognition and nutritional inference microservice.

- **Port**: 8084
- **Framework**: FastAPI (Python)
- **Production LLM**: Google Gemini (`gemini-3.1-flash-lite`) via its OpenAI-compatible endpoint
- **Local dev LLM**: Ollama (free, offline, no API key needed)
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

Production (Helm chart) routes through Google Gemini's OpenAI-compatible endpoint:

```
LLM_PROVIDER=openai
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
OPENAI_MODEL=gemini-3.1-flash-lite
OPENAI_API_KEY=<Google AI Studio key>
NUTRITION_DATA_PROVIDER=local
```

This uses LangChain's `ChatOpenAI` class pointed at Gemini — no Ollama or separate Google package needed in the Docker image.

## Local development

### Option A — Ollama (recommended, no API key)

```bash
# 1. Install Ollama from https://ollama.ai and pull a vision model
ollama pull llava

# 2. Set environment
export LLM_PROVIDER=ollama
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=llava
export NUTRITION_DATA_PROVIDER=local

# 3. Run
cd services/genai-service
pip install -r requirements.txt
uvicorn app:app --reload --port 8084
```

### Option B — Gemini (matches production)

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

The service is included in the root `docker-compose.yml`. Set `LLM_PROVIDER`, `OLLAMA_BASE_URL` (or `OPENAI_API_KEY`), and `GENAI_URL` in your `.env` file and run:

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
```

| Test file | Needs service? | Needs API key? | Runs in CI? |
|-----------|---------------|----------------|-------------|
| `test_unit.py` | No | No | Yes |
| `test_nutrition_lookup.py` | No | No | Yes |
| `test_smoke.py` | Yes (localhost:8084) | No | No |
| `test_image_expectations.py` | Yes (localhost:8084) | No | No |
| `test_genai_integration.py` | No | Yes (GOOGLE_API_KEY) | No (skip if no key) |

## Troubleshooting

**"NutritionAnalyzer not initialized"** — Check that the LLM provider env vars are set correctly. Check service logs for the exact initialization error.

**"Image analysis failed"** — Ensure the image is valid (JPG, PNG, WEBP) and not empty. Check rate limits on the LLM provider.

**Slow responses** — Vision LLM calls typically take 2–8 seconds. Gemini free tier may add latency under load.

**Ollama not found** — Make sure Ollama is running (`ollama serve`) and the model is pulled before starting the service.
