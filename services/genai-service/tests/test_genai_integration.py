"""Integration tests for the production GenAI provider (Google Gemini).

These tests call the real Gemini API via its OpenAI-compatible endpoint — the
same configuration used in production (Helm values.yaml).

They are skipped automatically when GOOGLE_API_KEY is not set, so CI passes
without a key. Run manually or in a dedicated integration job:

    export GOOGLE_API_KEY=your-key
    cd services/genai-service
    pytest tests/test_genai_integration.py -v -m integration

Production config:
    LLM_PROVIDER=openai
    OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
    OPENAI_MODEL=gemini-3.1-flash-lite
"""
from __future__ import annotations

import base64
import io
import os
import sys
from pathlib import Path

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent.parent))

from nutrition_analyzer import NutritionAnalyzer, NutritionResponse

pytestmark = pytest.mark.integration

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")


def _requires_api_key():
    if not GOOGLE_API_KEY:
        pytest.skip("GOOGLE_API_KEY not set — skipping Gemini integration tests")


def _make_gemini_analyzer() -> NutritionAnalyzer:
    """Build a NutritionAnalyzer configured exactly as production (Helm values.yaml).

    config.py values are module-level constants evaluated at import time, so
    setting os.environ after import has no effect. We patch the names directly
    in the nutrition_analyzer module namespace instead.
    """
    import nutrition_analyzer as na_mod

    na_mod.LLM_PROVIDER = "openai"
    na_mod.OPENAI_API_KEY = GOOGLE_API_KEY
    na_mod.OPENAI_BASE_URL = GEMINI_BASE_URL
    na_mod.OPENAI_MODEL = GEMINI_MODEL
    na_mod.NUTRITION_DATA_PROVIDER = "local"

    return NutritionAnalyzer()


def _food_image_b64(color: tuple = (210, 105, 30), size: tuple = (200, 200)) -> str:
    """Generate a simple coloured image as a stand-in food photo."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode()


def _real_image_b64(filename: str) -> str | None:
    """Load a real test image from the test-images directory if it exists."""
    repo_root = Path(__file__).resolve().parents[3]
    path = repo_root / "test-images" / filename
    if not path.exists():
        return None
    return base64.b64encode(path.read_bytes()).decode()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestGeminiProvider:
    def setup_method(self):
        _requires_api_key()
        self.analyzer = _make_gemini_analyzer()

    def test_response_has_required_fields(self):
        result = self.analyzer.analyze(_food_image_b64())
        assert isinstance(result, NutritionResponse)
        assert isinstance(result.foods, list)
        assert isinstance(result.calories, float)
        assert isinstance(result.protein_grams, float)
        assert isinstance(result.carbs_grams, float)
        assert isinstance(result.fat_grams, float)
        assert isinstance(result.fiber_grams, float)
        assert isinstance(result.confidence, float)

    def test_calories_non_negative(self):
        result = self.analyzer.analyze(_food_image_b64())
        assert result.calories >= 0.0

    def test_confidence_in_range(self):
        result = self.analyzer.analyze(_food_image_b64())
        assert 0.0 <= result.confidence <= 1.0

    def test_macros_non_negative(self):
        result = self.analyzer.analyze(_food_image_b64())
        assert result.protein_grams >= 0.0
        assert result.carbs_grams >= 0.0
        assert result.fat_grams >= 0.0
        assert result.fiber_grams >= 0.0

    @pytest.mark.parametrize("img_file,expected_token", [
        ("Hamburger.jpg", ["burger", "hamburger", "bun", "beef"]),
        ("Chicken-and-Broccoli.jpg", ["chicken", "broccoli"]),
    ])
    def test_real_image_detects_expected_food(self, img_file, expected_token):
        b64 = _real_image_b64(img_file)
        if b64 is None:
            pytest.skip(f"Test image not found: {img_file}")

        result = self.analyzer.analyze(b64)
        foods_text = " ".join(result.foods).lower()
        assert any(tok in foods_text for tok in expected_token), (
            f"None of {expected_token} found in detected foods: {result.foods}"
        )
        assert result.calories > 0, "Expected positive calorie estimate for real food image"

    def test_returns_result_within_reasonable_time(self):
        import time
        start = time.time()
        self.analyzer.analyze(_food_image_b64())
        elapsed = time.time() - start
        assert elapsed < 30, f"Gemini call took {elapsed:.1f}s — expected < 30s"
