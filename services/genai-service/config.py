import os

# ============================================================================
# LLM Configuration: Ollama (local, default) + OpenAI (cloud, fallback)
# ============================================================================

# Primary provider: "ollama" (local) or "openai" (cloud)
# If Ollama is unavailable, automatically falls back to OpenAI
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")

# Ollama configuration (local inference)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llava")  # Vision model for images
# Options: llava, llava-phi, bakllava, etc. All are free and open-source

# OpenAI configuration (cloud, used as fallback)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = "gpt-4o"  # Multi-modal (vision) capable

# genai-service configuration
PORT = int(os.getenv("PORT", 8084))
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

# Validation
if LLM_PROVIDER not in ["ollama", "openai"]:
    raise ValueError(f"Invalid LLM_PROVIDER: {LLM_PROVIDER}. Must be 'ollama' or 'openai'.")

print(f"[Config] LLM_PROVIDER: {LLM_PROVIDER}")
if LLM_PROVIDER == "ollama":
    print(f"[Config] Ollama URL: {OLLAMA_BASE_URL}, Model: {OLLAMA_MODEL}")
    print(f"[Config] OpenAI API Key set: {bool(OPENAI_API_KEY)} (fallback)")
elif LLM_PROVIDER == "openai":
    print(f"[Config] OpenAI Model: {OPENAI_MODEL}")
    print(f"[Config] Ollama URL: {OLLAMA_BASE_URL} (fallback)")
