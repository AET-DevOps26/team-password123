FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies (pillow/numpy ship manylinux wheels,
# so no system build packages are needed).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY app.py config.py nutrition_analyzer.py nutrition_db.json ./

# Run as a non-root, numeric UID so Kubernetes runAsNonRoot can verify it.
RUN useradd -u 1001 -r -m -s /usr/sbin/nologin appuser && chown -R appuser /app
USER 1001

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
