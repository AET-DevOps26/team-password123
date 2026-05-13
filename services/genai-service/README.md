# GenAI Service

Multi-modal LLM-powered food image recognition and nutritional inference microservice.

- **Port**: 8084
- **Framework**: FastAPI (Python)
- **Default LLM**: Ollama (local, free, offline-capable)
- **Fallback LLM**: OpenAI GPT-4o (cloud, premium accuracy)
- **Architecture**: LangChain abstracts provider switching

## Endpoints

| Method | Path | Input | Output | Notes |
|--------|------|-------|--------|-------|
| POST | `/api/analyze` | File upload (image) | `NutritionResponse` | Recommended for file uploads |
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

### Current Implementation: Lookup Table (MVP)
The service currently uses a **static JSON lookup table** (`nutrition_db.json`) containing standardized nutritional values for common foods. Each entry includes:
- Calories per 100g
- Protein, carbs, fat, and fiber per 100g

**Example: Broccoli (100g)**
```json
{
  "name": "Broccoli",
  "calories_per_100g": 34,
  "protein_per_100g": 2.8,
  "carbs_per_100g": 7,
  "fat_per_100g": 0.4,
  "fiber_per_100g": 2.4
}
```

### Why a Lookup Table?
- **Accurate**: Based on USDA/nutritional standards
- **Fast**: No API calls needed
- **Reliable**: Consistent values across requests
- **Offline**: Works without external services

### Future: AI-Powered Nutrition Model
This lookup table is a **temporary solution** for MVP validation. Future versions will:
- Train a custom ML model on food composition data
- Support variable cooking methods and preparation styles
- Handle regional/brand variations
- Reduce manual lookup maintenance
- Provide confidence scores per nutrient prediction

For now, the workflow is:
1. Vision model (llava) **identifies foods** and estimates portions (grams)
2. Lookup table **provides accurate macros** per 100g
3. Calculations **scale by portion size** to get final estimates

## Local Development

### Prerequisites
- Ollama installed from https://ollama.ai (for local inference)
- **OR** OpenAI API key (for cloud fallback)

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

# Ollama settings
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llava-phi

# OpenAI settings (optional, used as fallback)
OPENAI_API_KEY=sk-...  # Only needed if using OpenAI or as fallback

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

1. **TODO**: Fill in [nutrition_analyzer.py](nutrition_analyzer.py) with actual LLM logic
2. **TODO**: Test `/api/analyze` locally with Swagger UI
3. **TODO**: Update [docker-compose.yml](../../docker-compose.yml) with genai-service section
4. **TODO**: Wire genai-service into meals-service photo handling
5. **TODO**: Add tests for different food types and edge cases

## Completed

- ✅ GenAI service working locally with Ollama
- ✅ FastAPI endpoints for image analysis
- ✅ Docker image builds successfully
- ✅ Added to docker-compose.yml (connects to host Ollama on Windows)
- ✅ Smoke tests created and documented
- ✅ .env.example added with Ollama requirement documentation

## Future Improvements

1. Wire genai-service into meals-service photo handling
2. Add caching for repeated analyses
3. Support multiple vision models (llava, bakllava, llava-phi)
4. Expose Prometheus metrics for monitoring
5. Add GitHub Actions CI/CD job to build and test genai-service
6. Load-test with high-volume image submissions
