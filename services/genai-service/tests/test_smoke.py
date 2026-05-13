"""
Smoke tests for GenAI service.

These tests verify that the service is running and can handle basic requests.
Run with: pytest tests/test_smoke.py -v
"""

import io
import os
import json
import requests
from PIL import Image
import pytest


# Configure the base URL for the service
BASE_URL = os.getenv("GENAI_SERVICE_URL", "http://localhost:8084")


@pytest.fixture(scope="session")
def service_is_running():
    """Check that the service is running before running tests."""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        assert response.status_code == 200, f"Service not running: {response.status_code}"
        return True
    except Exception as e:
        pytest.skip(f"Service not running at {BASE_URL}: {e}")


@pytest.fixture
def test_image():
    """Generate a simple test image (100x100 PNG with some food-like colors)."""
    img = Image.new('RGB', (100, 100), color=(210, 105, 30))  # Saddle brown color (food-like)
    
    # Add a lighter rectangle to simulate a plate
    for x in range(20, 80):
        for y in range(20, 80):
            img.putpixel((x, y), (255, 200, 124))  # Lighter shade
    
    # Convert to bytes
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    return img_bytes


class TestGenAIService:
    """Smoke tests for GenAI service endpoints."""

    def test_health_endpoint(self, service_is_running):
        """Test that /health endpoint returns 200 and proper response."""
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "genai-service"

    def test_analyze_endpoint_accepts_image(self, service_is_running, test_image):
        """Test that /api/analyze endpoint accepts an image and returns valid JSON."""
        files = {'file': ('test.png', test_image, 'image/png')}
        response = requests.post(
            f"{BASE_URL}/api/analyze",
            files=files,
            timeout=30  # Analysis can take time with Ollama
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response has expected structure
        assert "foods" in data or "error" not in data  # Either foods list or no error
        assert isinstance(data, dict)

    def test_analyze_endpoint_response_structure(self, service_is_running, test_image):
        """Test that /api/analyze returns expected fields."""
        files = {'file': ('test.png', test_image, 'image/png')}
        response = requests.post(
            f"{BASE_URL}/api/analyze",
            files=files,
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify nutrition data structure
        expected_fields = ['foods', 'calories', 'protein_grams', 'carbs_grams', 'fat_grams']
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"

    def test_analyze_endpoint_with_missing_file(self, service_is_running):
        """Test that /api/analyze returns error when no file is provided."""
        response = requests.post(
            f"{BASE_URL}/api/analyze",
            timeout=5
        )
        
        # Should return 400 or 422 for missing file
        assert response.status_code in [400, 422], f"Expected error status, got {response.status_code}"

    def test_service_responds_quickly_to_health(self, service_is_running):
        """Test that health check responds within reasonable time."""
        import time
        start = time.time()
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 2, f"Health check took {elapsed}s, expected < 2s"


if __name__ == "__main__":
    # Run with: python -m pytest tests/test_smoke.py -v
    pytest.main([__file__, "-v", "-s"])
