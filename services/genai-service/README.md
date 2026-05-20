# GenAI Service

Multi-modal LLM-powered food image recognition and nutritional inference microservice.

- **Port**: 8084
- **Framework**: FastAPI (Python)
- **Default LLM**: Ollama (local, free, offline-capable)
- **Fallback LLMs**: OpenAI GPT-4o or Google Gemini (cloud)
- **Nutrition data**: USDA FoodData Central first, then Open Food Facts, with a local cache fallback
- **Architecture**: LangChain abstracts provider switching

## Endpoints

| Method | Path | Input | Output | Notes |
|--------|------|-------|--------|-------|
| POST | `/api/analyze` | File upload (image) | `NutritionResponse` | Recommended for file uploads |
| POST | `/api/analyze/compare` | File upload (image) | `NutritionComparisonResponse` | Compares two LLM vision providers and calorie estimates |
| POST | `/api/analyze/base64` | JSON `{"image": "base64_string"}` | `NutritionResponse` | For pre-encoded images |
| GET | `/health` | none | `{"status": "ok"}` | Health check |

## Response Format

```json
{
  "foods": ["grilled chicken", "brown rice", "broccoli"],
  "calories": 550,
  "protein_grams": 45,
  "carbs_grams": 55,
  "fat_grams": 12,
  "fiber_grams": 4,
  "confidence": 0.92
}
```

## Nutrition Data

### Nutrition Data Sources
The service now resolves nutrition values through a live lookup pipeline:

1. **USDA FoodData Central** as the primary nutrition source.
2. **Open Food Facts** for packaged foods and branded products.
3. **Local cache fallback** (`nutrition_db.json`) for offline or partial coverage.

This keeps the current image-analysis flow intact while replacing the old MVP-only table with real data sources. The analyzer still scales the per-100g values by the portion estimate returned by the vision model.

The service also exposes a provider comparison path so you can see how two vision models differ on the same image and how far apart their calorie estimates are.

## Local Development

### Prerequisites
- Ollama installed from https://ollama.ai (for local inference)
- **OR** OpenAI API key (for cloud fallback)
- **OR** Google Gemini API key for the Google provider path
- USDA FoodData Central API key for the best nutrition coverage

### Step 1: Download a vision model (Ollama)

If using Ollama locally, pull a vision model:

```bash
ollama pull llava-phi  # Lightweight, good for testing (~5GB)
# or
ollama pull llava      # Slightly better accuracy (~45GB)
# or
ollama pull bakllava   # Fast alternative (~5GB)
```

Then start Ollama (it runs on `http://localhost:11434` by default).

### Step 2: Set environment variables

Create a `.env` file in `services/genai-service/`:

```bash
# Choose default provider
LLM_PROVIDER=ollama
# or: LLM_PROVIDER=openai
# or: LLM_PROVIDER=google

# Ollama settings
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llava-phi

# OpenAI settings (optional, used as fallback)
OPENAI_API_KEY=sk-...  # Only needed if using OpenAI or as fallback

# Google Gemini settings (optional, used if LLM_PROVIDER=google or as fallback)
# GOOGLE_API_KEY=AIza...
GOOGLE_MODEL=gemini-2.0-flash

# Nutrition data source selection
NUTRITION_DATA_PROVIDER=usda
USDA_FDC_API_KEY=...

PORT=8084
DEBUG=true
```

### Step 3: Install Python dependencies

```bash
cd services/genai-service
python -m venv venv
venv\Scripts\activate  # Windows
# or: source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
```

### Step 4: Run the service

```bash
uvicorn app:app --reload --port 8084
```

Visit **http://localhost:8084/docs** for interactive API documentation (Swagger UI).

### Step 5: Test locally

**Option A: Upload a food image**
```bash
curl -X POST http://localhost:8084/api/analyze \
  -F "file=@/path/to/meal.jpg"
```

**Option B: Send base64-encoded image**
```bash
curl -X POST http://localhost:8084/api/analyze/base64 \
  -H "Content-Type: application/json" \
  -d '{"image": "base64_encoded_image_string"}'
```

**Option C: Compare two providers**
```bash
curl -X POST http://localhost:8084/api/analyze/compare \
  -F "file=@/path/to/meal.jpg"
```

This returns both provider outputs and a `calorie_difference` so you can compare how far apart their estimates are.

Expected response:
```json
{
  "foods": ["chicken", "rice", "broccoli"],

  ### Running Smoke Tests

  Verify that the service is working correctly:

  ```bash
  # Make sure the service is running (uvicorn app:app --reload --port 8084)
  # In a new terminal, from services/genai-service/:
  pytest tests/test_smoke.py -v
  ```

  This will run smoke tests that verify:
  - ✅ Health endpoint responds correctly
  - ✅ Image analysis endpoint accepts images and returns valid JSON
  - ✅ Response contains expected nutrition fields
  - ✅ Error handling for missing files

  Example output:
  ```
  tests/test_smoke.py::TestGenAIService::test_health_endpoint PASSED
  tests/test_smoke.py::TestGenAIService::test_analyze_endpoint_accepts_image PASSED
  tests/test_smoke.py::TestGenAIService::test_analyze_endpoint_response_structure PASSED
  ```

  "calories": 550,
  "protein_grams": 45,
  "carbs_grams": 55,
  "fat_grams": 12,
  "fiber_grams": 4,
  "confidence": 0.92
}
```

## Docker / docker-compose

After testing locally, containerize the service via [Dockerfile](Dockerfile).

**Next step**: Add this to the root [docker-compose.yml](../../docker-compose.yml):

```yaml
genai-service:
  build: ./services/genai-service
  environment:
    LLM_PROVIDER: ${LLM_PROVIDER:-ollama}
    OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://ollama:11434}
    OLLAMA_MODEL: ${OLLAMA_MODEL:-llava-phi}
    OPENAI_API_KEY: ${OPENAI_API_KEY}
    PORT: 8084
    DEBUG: ${DEBUG:-false}
  ports:
    - "8084:8084"
  depends_on:
    - postgres
  # If running Ollama locally outside Docker, comment out this section
  # If Ollama is containerized, add:
  # links:
  #   - ollama:ollama
```

**For Ollama in Docker**, also add:
```yaml
ollama:
  image: ollama/ollama:latest
  environment:
    OLLAMA_MODEL: ${OLLAMA_MODEL:-llava-phi}
  ports:
    - "11434:11434"
  volumes:
    - ollama-data:/root/.ollama
  # On first run, pull the model:
  # docker exec <container_id> ollama pull llava-phi
```

Then start everything:
```bash
docker compose up --build
```

## Integration with meals-service

After this service is stable, wire it into [meals-service](../meals-service):

1. meals-service receives a photo upload
2. meals-service stores it with `status: AI_NOT_AVAILABLE`
3. meals-service calls `POST http://genai-service:8084/api/analyze` with the image
4. meals-service receives the nutrition prediction and either:
   - Auto-creates a `MealLog` with those macros, or
   - Returns the prediction to the iOS app for user confirmation

See [meals-service/README.md](../meals-service/README.md) for exact endpoint wiring.

## Troubleshooting

**"NutritionAnalyzer not initialized"**
- Check that `LLM_PROVIDER` is set correctly
- Check that your API key env var is set and valid
- Check logs for initialization errors

**"Image analysis failed"**
- Ensure the image is valid (JPG, PNG, WEBP)
- Check that the LLM API is reachable
- Check rate limits on your LLM provider

**Slow responses**
- Multi-modal LLM calls can take 2-5 seconds
- Consider adding response caching or async queues for high traffic

## Next Steps

1. Tune the provider defaults for your deployment mix.
2. Add caching or rate-limit protection if nutrition lookups get heavy.
3. Wire genai-service into meals-service photo handling.
4. Add more food-specific tests and image fixtures.

## Completed

- ✅ GenAI service working locally with Ollama
- ✅ Google Gemini provider path added
- ✅ Live nutrition lookup via USDA FoodData Central and Open Food Facts
- ✅ FastAPI endpoints for image analysis
- ✅ Docker image builds successfully
- ✅ Added to docker-compose.yml (connects to host Ollama on Windows)
- ✅ Smoke tests created and documented
- ✅ .env.example updated for Google and nutrition API configuration

## Future Improvements

1. Wire genai-service into meals-service photo handling
2. Add caching for repeated analyses
3. Expose Prometheus metrics for monitoring
4. Add GitHub Actions CI/CD job to build and test genai-service
5. Load-test with high-volume image submissions
