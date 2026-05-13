"""
FastAPI microservice for nutrition analysis via GenAI.

Architecture:
- Ollama (local, default): Free, runs offline, good for development
- OpenAI (cloud, fallback): Premium, higher accuracy, production-ready
- LangChain abstracts the provider switching

To run locally:
  1. Start Ollama: download and run from https://ollama.ai
  2. Pull a vision model: ollama pull llava-phi
  3. uvicorn app:app --reload --port 8084
  4. Visit http://localhost:8084/docs
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, status
from fastapi.responses import JSONResponse
import base64
import logging
from datetime import datetime, timezone

from nutrition_analyzer import NutritionAnalyzer, NutritionResponse
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
    description="Analyzes food images and returns nutritional estimates using Ollama or OpenAI",
    version="0.1.0"
)

# Initialize the analyzer
analyzer = None
try:
    logger.info("Initializing NutritionAnalyzer...")
    analyzer = NutritionAnalyzer()
    logger.info("NutritionAnalyzer initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize NutritionAnalyzer: {e}")


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
        status_info["error"] = "NutritionAnalyzer not initialized. Check Ollama or OpenAI configuration."
    
    return status_info


@app.post("/api/analyze", response_model=NutritionResponse)
async def analyze_meal(file: UploadFile = File(...)):
    """
    Analyze a meal image and return nutritional estimates.
    
    Args:
        file: Image file (JPG, PNG, WEBP, etc.)
        
    Returns:
        NutritionResponse with estimated macros and confidence score
    """
    if not analyzer:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GenAI service not initialized. Ensure Ollama is running (http://localhost:11434) or OPENAI_API_KEY is set."
        )
    
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
        logger.info(f"Analyzing image: {file.filename}")
        result = analyzer.analyze(image_base64)
        
        logger.info(f"Analysis result: {result.calories} cal, confidence {result.confidence}")
        return result
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT, debug=DEBUG)

