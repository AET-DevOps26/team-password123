"""
FastAPI microservice for nutrition analysis via GenAI.

Architecture:
- Google Gemini (cloud, primary): OpenAI-compatible endpoint for production
- OpenAI-compatible open-weight API (backup): Used when the primary path fails
- LangChain abstracts the provider switching

To run locally:
    1. Set OPENAI_BASE_URL to your Gemini endpoint
    2. Set BACKUP_OPENAI_* to your backup model endpoint
    3. uvicorn app:app --reload --port 8084
    4. Visit http://localhost:8084/docs
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, status, Query, Request
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Counter, Histogram, Summary
import base64
import logging
import os
import time
from datetime import datetime, timezone

from pydantic import BaseModel

from nutrition_analyzer import (
    NutritionAnalyzer,
    NutritionResponse,
    NutritionComparisonResponse,
    LLMUnavailableError,
    LLMResponseError,
)
from health_rag import HealthInsightEngine, build_index
from config import PORT, DEBUG

# Set up logging
logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format="[%(asctime)s] %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Nutrition GenAI Service",
    description="Analyzes food images and returns nutritional estimates using Google Gemini with an OpenAI-compatible backup endpoint",
    version="0.1.0"
)

# Reject oversized bodies before Starlette buffers them into memory, so a huge
# upload to the (unauthenticated) analyze endpoints can't exhaust worker RAM.
# This also neutralises the reachable path of the Starlette multipart CVE
# (CVE-2024-47874) that the pinned fastapi==0.104.1 carries. 15MB mirrors
# meals-service's 10MB multipart cap plus headroom for base64 inflation.
# ponytail: Content-Length check only — a chunked body with no length slips past;
# the sole prod caller (meals-service) always sends a bounded, length-tagged body.
MAX_REQUEST_BYTES = 15 * 1024 * 1024


@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            too_large = int(content_length) > MAX_REQUEST_BYTES
        except ValueError:
            return JSONResponse(status_code=400, content={"detail": "Invalid Content-Length"})
        if too_large:
            return JSONResponse(status_code=413, content={"detail": "Request body too large"})
    return await call_next(request)


# Expose Prometheus metrics at /metrics for scraping.
Instrumentator().instrument(app).expose(app)


def _setup_tracing(fastapi_app: FastAPI) -> None:
    """Export FastAPI request spans over OTLP when OTEL_EXPORTER_OTLP_ENDPOINT is
    set, so genai appears in the cross-service trace (analytics -> genai). A no-op
    when unset, so local dev and unit tests emit no spans and need no collector."""
    if not os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"):
        return
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        resource = Resource.create(
            {"service.name": os.getenv("OTEL_SERVICE_NAME", "genai-service")}
        )
        provider = TracerProvider(resource=resource)
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
        trace.set_tracer_provider(provider)
        FastAPIInstrumentor.instrument_app(fastapi_app)
        logger.info("Tracing enabled -> %s", os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"))
    except Exception as exc:  # never let tracing setup break the app
        logger.warning("Tracing setup skipped: %s", exc)


_setup_tracing(app)

# Custom business metrics — these live alongside the HTTP metrics above and
# capture signal the request metrics can't (which provider answered, success vs
# fallback vs hard failure, model latency).
GENAI_ANALYZE = Counter(
    "calorieasy_genai_analyze_total",
    "Meal-image analyses",
    ["result", "vision_model"],
)
GENAI_ESTIMATE = Counter(
    "calorieasy_genai_estimate_total", "Food-name nutrition estimates", ["result", "source"]
)
GENAI_LATENCY = Histogram(
    "calorieasy_genai_analyze_seconds",
    "Wall-clock seconds per image analysis",
    ["vision_model"],
    buckets=(0.5, 1, 2, 3, 5, 10, 20, 30, 45, 60, 90, 120),
)
GENAI_CONFIDENCE = Summary(
    "calorieasy_genai_analyze_confidence",
    "Model-reported confidence score (0–1)",
    ["vision_model"],
)
GENAI_INSIGHT = Counter(
    "calorieasy_genai_insight_total", "RAG health insights", ["result"]
)
GENAI_INSIGHT_LATENCY = Histogram(
    "calorieasy_genai_insight_seconds", "Wall-clock seconds per health insight"
)


def _metrics_model_label(*, result: NutritionResponse | None, vision_provider: str) -> str:
    if result and result.vision_model:
        return result.vision_model
    preference = (vision_provider or "auto").strip().lower()
    if preference == "gemini":
        return "Gemini"
    if preference == "nemotron":
        return "Nemotron"
    return "Auto"

# Initialize the analyzer
analyzer = None
try:
    logger.info("Initializing NutritionAnalyzer...")
    analyzer = NutritionAnalyzer()
    logger.info("NutritionAnalyzer initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize NutritionAnalyzer: {e}")


# Lazily-initialized RAG insight engine (mirrors the analyzer lifecycle). Built
# on first use so importing the module stays cheap and tests can inject a fake.
_insight_engine = None


def get_insight_engine() -> HealthInsightEngine:
    global _insight_engine
    if _insight_engine is None:
        _insight_engine = HealthInsightEngine()
    return _insight_engine


@app.on_event("startup")
def _build_health_index_on_startup() -> None:
    """Best-effort: populate the HealthFact index if Weaviate is up and empty.
    Must never crash the app — a down/unconfigured Weaviate is tolerated."""
    try:
        engine = get_insight_engine()
        store = engine.store
        if not store.is_ready():
            logger.warning("Weaviate not reachable; skipping health-index build")
            return
        if store.is_populated():
            logger.info("HealthFact index already populated")
            return
        written = build_index(embedder=engine.embedder, store=store)
        logger.info("Built HealthFact index: %d facts", written)
    except Exception as exc:
        logger.warning("Health-index build skipped: %s", exc)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    status_info = {
        "status": "ok" if analyzer else "degraded",
        "service": "genai-service",
        "analyzer_ready": analyzer is not None,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    if not analyzer:
        status_info["error"] = "NutritionAnalyzer not initialized. Check Google Gemini, backup endpoint, or API key configuration."
    
    return status_info


class FoodEstimateRequest(BaseModel):
    food_name: str


class FoodEstimateResponse(BaseModel):
    food_name: str
    calories_per_100g: float
    protein_grams_per_100g: float
    carbs_grams_per_100g: float
    fat_grams_per_100g: float
    typical_portion_grams: float
    typical_portion_label: str
    source: str
    confidence: float


@app.post("/api/estimate", response_model=FoodEstimateResponse)
async def estimate_food(request: FoodEstimateRequest):
    """
    Estimate nutrition per 100g for a food by name, plus a typical serving size.
    Tries USDA database first, falls back to text LLM (e.g. Logos).
    """
    if not analyzer:
        GENAI_ESTIMATE.labels(result="unavailable", source="none").inc()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GenAI service not initialized.")
    food_name = request.food_name.strip() if request.food_name else ""
    if not food_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="food_name is required.")
    # Defense for this unauthenticated, host-published endpoint: bound the input
    # length before it ever reaches the LLM prompt.
    if len(food_name) > 120:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="food_name must be 120 characters or fewer.")
    try:
        result = analyzer.estimate_from_name(food_name)
        GENAI_ESTIMATE.labels(result="success", source=result.get("source", "unknown")).inc()
        logger.info(
            "Estimated '%s': %.0f kcal/100g, portion=%.0fg '%s' [%s]",
            request.food_name, result["calories_per_100g"],
            result["typical_portion_grams"], result["typical_portion_label"],
            result["source"],
        )
        return result
    except LLMUnavailableError as e:
        # Backend has no usable LLM — a service problem, not bad client input.
        GENAI_ESTIMATE.labels(result="unavailable", source="none").inc()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except LLMResponseError as e:
        # Upstream LLM returned something we couldn't parse — bad gateway.
        GENAI_ESTIMATE.labels(result="error", source="none").inc()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    except ValueError as e:
        GENAI_ESTIMATE.labels(result="bad_request", source="none").inc()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        GENAI_ESTIMATE.labels(result="error", source="none").inc()
        logger.error("Estimation error: %s", e, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Estimation failed.")


@app.post("/api/analyze", response_model=NutritionResponse)
async def analyze_meal(
    file: UploadFile = File(...),
    vision_provider: str = Query(default="auto", alias="vision_provider"),
):
    """
    Analyze a meal image and return nutritional estimates.
    
    Args:
        file: Image file (JPG, PNG, WEBP, etc.)
        
    Returns:
        NutritionResponse with estimated macros and confidence score
    """
    if not analyzer:
        GENAI_ANALYZE.labels(result="unavailable", vision_model="unknown").inc()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GenAI service not initialized. Ensure Gemini or the backup endpoint is configured."
        )

    started = time.perf_counter()
    try:
        # Validate file
        if not file.filename:
            raise ValueError("File must have a name")

        # Read the image file
        image_data = await file.read()
        if not image_data:
            raise ValueError("Empty image file")

        # Encode to base64
        image_base64 = base64.b64encode(image_data).decode("utf-8")

        # Analyze
        logger.info(f"Analyzing image: {file.filename} (vision_provider={vision_provider})")
        result = analyzer.analyze(image_base64, vision_provider=vision_provider)

        elapsed = time.perf_counter() - started
        model_label = _metrics_model_label(result=result, vision_provider=vision_provider)
        GENAI_LATENCY.labels(vision_model=model_label).observe(elapsed)
        GENAI_CONFIDENCE.labels(vision_model=model_label).observe(result.confidence)
        GENAI_ANALYZE.labels(result="success", vision_model=model_label).inc()
        logger.info(
            f"Analysis result: {result.calories} cal, confidence {result.confidence}, "
            f"model {model_label}, {elapsed:.2f}s"
        )
        return result

    except ValueError as e:
        model_label = _metrics_model_label(result=None, vision_provider=vision_provider)
        GENAI_ANALYZE.labels(result="bad_request", vision_model=model_label).inc()
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        elapsed = time.perf_counter() - started
        model_label = _metrics_model_label(result=None, vision_provider=vision_provider)
        GENAI_LATENCY.labels(vision_model=model_label).observe(elapsed)
        GENAI_ANALYZE.labels(result="error", vision_model=model_label).inc()
        logger.error(f"Analysis error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Image analysis failed. Check service logs."
        )


@app.post("/api/analyze/base64", response_model=NutritionResponse)
async def analyze_meal_base64(request_data: dict):
    """
    Analyze a meal using base64-encoded image.
    
    Request body:
        {"image": "base64_encoded_image_string"}
    
    Returns:
        NutritionResponse with estimated macros
    """
    if not analyzer:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GenAI service not initialized"
        )
    
    try:
        image_base64 = request_data.get("image")
        if not image_base64:
            raise ValueError("Missing 'image' field in request body")
        
        logger.info("Analyzing base64-encoded image")
        result = analyzer.analyze(image_base64)
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@app.post("/api/analyze/compare", response_model=NutritionComparisonResponse)
async def compare_meal(file: UploadFile = File(...)):
    """Analyze the same image with two providers and compare calorie estimates."""
    if not analyzer:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GenAI service not initialized. Ensure Gemini or the backup endpoint is configured."
        )

    try:
        if not file.filename:
            raise ValueError("File must have a name")

        image_data = await file.read()
        if not image_data:
            raise ValueError("Empty image file")

        image_base64 = base64.b64encode(image_data).decode("utf-8")

        logger.info(f"Comparing providers for image: {file.filename}")
        result = analyzer.compare_providers(image_base64)

        logger.info(
            "Comparison complete: primary %.0f cal vs secondary %.0f cal",
            result.primary.calories,
            result.secondary.calories,
        )
        return result

    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Comparison error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Comparison failed. Check service logs."
        )


class FoodTotal(BaseModel):
    name: str
    total_grams: float = 0


class InsightRequest(BaseModel):
    window: str = "week"
    foods: list[FoodTotal] = []
    nutrient_totals: dict[str, float] = {}
    days_logged: int = 0


class FactRef(BaseModel):
    id: str
    text: str


class InsightResponse(BaseModel):
    insight: str | None
    facts_used: list[FactRef]
    generated_by: str
    result: str


@app.post("/api/insight", response_model=InsightResponse)
async def health_insight(request: InsightRequest):
    """Generate a short, personalized health insight via RAG.

    Pipeline: embed a profile-derived query -> Weaviate top-k HealthFact search
    -> augment a text-LLM prompt with the retrieved facts -> generate. Fail-soft:
    a down Weaviate or LLM degrades gracefully (still HTTP 200) instead of erroring.
    """
    started = time.perf_counter()
    profile = {
        "window": request.window,
        "foods": [{"name": f.name, "total_grams": f.total_grams} for f in request.foods],
        "nutrient_totals": request.nutrient_totals,
        "days_logged": request.days_logged,
    }
    try:
        result = get_insight_engine().insight(profile)
    except Exception as exc:
        # The engine is fail-soft and should not raise, but guard anyway so the
        # endpoint never 500s on the insight path.
        GENAI_INSIGHT.labels(result="error").inc()
        GENAI_INSIGHT_LATENCY.observe(time.perf_counter() - started)
        logger.error("Insight generation failed: %s", exc, exc_info=True)
        return InsightResponse(
            insight=None, facts_used=[], generated_by="none", result="error"
        )

    GENAI_INSIGHT.labels(result=result.get("result", "error")).inc()
    GENAI_INSIGHT_LATENCY.observe(time.perf_counter() - started)
    logger.info(
        "Insight [%s] via %s using %d facts",
        result.get("result"),
        result.get("generated_by"),
        len(result.get("facts_used", [])),
    )
    return InsightResponse(**result)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT, debug=DEBUG)

