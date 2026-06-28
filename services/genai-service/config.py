import os

# ============================================================================
# LLM configuration: local, cloud, or Google Gemini.
# ============================================================================

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()

# Ollama configuration (local inference)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llava")

# OpenAI configuration (cloud, or any OpenAI-compatible gateway such as AET Logos)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
# Empty -> api.openai.com. Set to point at an OpenAI-compatible endpoint (e.g. Logos).
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "")

# Google Gemini configuration (cloud)
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GOOGLE_MODEL = os.getenv("GOOGLE_MODEL", "gemini-2.0-flash")

# Optional separate text LLM for food-name estimation (e.g. Logos).
# If unset, the primary LLM is used as fallback for text estimation too.
TEXT_OPENAI_BASE_URL = os.getenv("TEXT_OPENAI_BASE_URL", "")
TEXT_OPENAI_API_KEY = os.getenv("TEXT_OPENAI_API_KEY", "")
TEXT_OPENAI_MODEL = os.getenv("TEXT_OPENAI_MODEL", "openai/gpt-oss-120b")

# Nutrition data configuration
NUTRITION_DATA_PROVIDER = os.getenv("NUTRITION_DATA_PROVIDER", "usda").lower()
USDA_FDC_API_KEY = os.getenv("USDA_FDC_API_KEY", "")

# ============================================================================
# RAG health-insights configuration (Weaviate vector store + embeddings).
# ============================================================================

# Weaviate endpoint. The vector DB stores the HealthFact corpus; genai supplies
# the vectors (vectorizer: none), so no Weaviate inference module is needed.
WEAVIATE_URL = os.getenv("WEAVIATE_URL", "http://weaviate:8080")

# Embedding provider switch, mirroring LLM_PROVIDER:
#   local  -> fastembed BAAI/bge-small-en-v1.5 (384-dim, ONNX, offline, no torch)
#   openai -> OpenAI text-embedding-3-small (1536-dim, needs OPENAI_API_KEY)
EMBED_PROVIDER = os.getenv("EMBED_PROVIDER", "local").lower()
EMBED_MODEL_LOCAL = os.getenv("EMBED_MODEL_LOCAL", "BAAI/bge-small-en-v1.5")
OPENAI_EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")

# Health-facts corpus path; defaults to the file shipped beside this service.
HEALTH_FACTS_PATH = os.getenv(
    "HEALTH_FACTS_PATH",
    str((__import__("pathlib").Path(__file__).parent / "health_facts.json").resolve()),
)

# Top-k facts retrieved per insight query.
INSIGHT_TOPK = int(os.getenv("INSIGHT_TOPK", "5"))

# genai-service configuration
PORT = int(os.getenv("PORT", 8084))
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

if LLM_PROVIDER not in ["ollama", "openai", "google"]:
    raise ValueError(
        f"Invalid LLM_PROVIDER: {LLM_PROVIDER}. Must be 'ollama', 'openai', or 'google'."
    )

if NUTRITION_DATA_PROVIDER not in ["auto", "usda", "local"]:
    raise ValueError(
        "Invalid NUTRITION_DATA_PROVIDER: "
        f"{NUTRITION_DATA_PROVIDER}. Must be 'auto', 'usda', or 'local'."
    )

if EMBED_PROVIDER not in ["local", "openai"]:
    raise ValueError(
        f"Invalid EMBED_PROVIDER: {EMBED_PROVIDER}. Must be 'local' or 'openai'."
    )

if DEBUG:
    print(f"[Config] LLM_PROVIDER: {LLM_PROVIDER}")
    if LLM_PROVIDER == "ollama":
        print(f"[Config] Ollama URL: {OLLAMA_BASE_URL}, Model: {OLLAMA_MODEL}")
        print(f"[Config] OpenAI API Key set: {bool(OPENAI_API_KEY)} (fallback)")
        print(f"[Config] Google API Key set: {bool(GOOGLE_API_KEY)} (fallback)")
    elif LLM_PROVIDER == "openai":
        print(f"[Config] OpenAI Model: {OPENAI_MODEL}")
        print(f"[Config] Ollama URL: {OLLAMA_BASE_URL} (fallback)")
        print(f"[Config] Google API Key set: {bool(GOOGLE_API_KEY)} (fallback)")
    elif LLM_PROVIDER == "google":
        print(f"[Config] Google Model: {GOOGLE_MODEL}")
        print(f"[Config] Ollama URL: {OLLAMA_BASE_URL} (fallback)")
        print(f"[Config] OpenAI API Key set: {bool(OPENAI_API_KEY)} (fallback)")

    print(f"[Config] NUTRITION_DATA_PROVIDER: {NUTRITION_DATA_PROVIDER}")
    print(f"[Config] USDA_FDC_API_KEY set: {bool(USDA_FDC_API_KEY)}")
