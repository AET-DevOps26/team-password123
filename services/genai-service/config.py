import os

# ============================================================================
# LLM configuration: cloud primary plus optional backup provider.
# ============================================================================

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower()

# OpenAI configuration (cloud, or any OpenAI-compatible gateway such as AET Logos)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
# Empty -> api.openai.com. Set to point at an OpenAI-compatible endpoint (e.g. Logos).
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "")

# Backup OpenAI-compatible configuration (used when the primary provider fails).
BACKUP_OPENAI_API_KEY = os.getenv("BACKUP_OPENAI_API_KEY", "")
BACKUP_OPENAI_MODEL = os.getenv("BACKUP_OPENAI_MODEL", "")
BACKUP_OPENAI_BASE_URL = os.getenv("BACKUP_OPENAI_BASE_URL", "")
# Nemotron backup: cap output, resize images, and disable reasoning for speed.
BACKUP_OPENAI_MAX_TOKENS = int(os.getenv("BACKUP_OPENAI_MAX_TOKENS", "256"))
BACKUP_VISION_TIMEOUT_SEC = float(os.getenv("BACKUP_VISION_TIMEOUT_SEC", "90"))
BACKUP_VISION_MAX_SIDE = int(os.getenv("BACKUP_VISION_MAX_SIDE", "384"))

# Google Gemini configuration (cloud)
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GOOGLE_MODEL = os.getenv("GOOGLE_MODEL", "gemini-2.0-flash")

# Dedicated text LLM for food-name estimation and the health-insight RAG
# generation. Defaults to AET Logos gpt-oss-120b; only the API key must be
# supplied (via env / .env / Secret — never committed). Without a key the text
# LLM stays unconfigured and those paths fail soft.
TEXT_OPENAI_BASE_URL = os.getenv("TEXT_OPENAI_BASE_URL", "https://logos.aet.cit.tum.de/v1")
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

if LLM_PROVIDER not in ["openai", "google"]:
    raise ValueError(
        f"Invalid LLM_PROVIDER: {LLM_PROVIDER}. Must be 'openai' or 'google'."
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
    if LLM_PROVIDER == "openai":
        print(f"[Config] OpenAI Model: {OPENAI_MODEL}")
        print(f"[Config] Backup OpenAI-compatible endpoint set: {bool(BACKUP_OPENAI_BASE_URL)}")
    elif LLM_PROVIDER == "google":
        print(f"[Config] Google Model: {GOOGLE_MODEL}")
        print(f"[Config] Backup OpenAI-compatible endpoint set: {bool(BACKUP_OPENAI_BASE_URL)}")
    print(f"[Config] NUTRITION_DATA_PROVIDER: {NUTRITION_DATA_PROVIDER}")
    print(f"[Config] USDA_FDC_API_KEY set: {bool(USDA_FDC_API_KEY)}")
