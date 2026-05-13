FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (if needed for image processing)
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY app.py .
COPY config.py .
COPY nutrition_analyzer.py .

# Expose port
EXPOSE 8084

# Environment defaults (override in docker-compose.yml or .env)
ENV LLM_PROVIDER=ollama
ENV OLLAMA_BASE_URL=http://ollama:11434
ENV OLLAMA_MODEL=llava
ENV PORT=8084
ENV DEBUG=false

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import requests; response = requests.get('http://localhost:8084/health'); exit(0 if response.status_code == 200 else 1)" || exit 1

# Run the FastAPI app with uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8084"]

