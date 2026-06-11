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

# Nutrition data configuration
NUTRITION_DATA_PROVIDER = os.getenv("NUTRITION_DATA_PROVIDER", "usda").lower()
USDA_FDC_API_KEY = os.getenv("USDA_FDC_API_KEY", "")

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
