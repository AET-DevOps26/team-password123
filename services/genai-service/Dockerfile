FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies (pillow/numpy ship manylinux wheels,
# so no system build packages are needed).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code. health_rag.py + health_facts.json power the RAG
# health-insight endpoint; build_health_index.py lets an init job/operator seed
# Weaviate out of band.
COPY app.py config.py nutrition_analyzer.py nutrition_db.json health_rag.py health_facts.json ./
COPY scripts/build_health_index.py ./scripts/build_health_index.py

# Run as a non-root, numeric UID so Kubernetes runAsNonRoot can verify it.
RUN useradd -u 1001 -r -m -s /usr/sbin/nologin appuser && chown -R appuser /app
USER 1001

# Pre-bake the local embedding model (fastembed BAAI/bge-small-en-v1.5) so the
# startup index build and the first /api/insight work offline with no cold-start
# download. Runs as appuser so the cache lands in this user's home.
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5')"

# Expose port
EXPOSE 8084

# Environment defaults (override in docker-compose.yml or .env)
ENV LLM_PROVIDER=ollama \
    OLLAMA_BASE_URL=http://ollama:11434 \
    OLLAMA_MODEL=llava \
    NUTRITION_DATA_PROVIDER=usda \
    PORT=8084 \
    DEBUG=false

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import requests; exit(0 if requests.get('http://localhost:8084/health', timeout=5).status_code == 200 else 1)" || exit 1

# Run the FastAPI app with uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8084"]
