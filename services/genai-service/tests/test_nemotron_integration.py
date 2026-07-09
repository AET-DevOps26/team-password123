"""Integration tests for the OpenRouter Nemotron backup vision model.

Forces Gemini primary to fail (invalid OPENAI_API_KEY) and exercises the
BACKUP_OPENAI_* fallback path against the real OpenRouter API.

Skipped automatically when BACKUP_OPENAI_API_KEY / OPENROUTER_API_KEY is unset
(CI runs headless unit tests without keys).

Run locally:
  cd services/genai-service
  pytest tests/test_nemotron_integration.py -v -m integration

Requires repo/test-images/ for the food-photo cases.
"""

from __future__ import annotations

import base64
import importlib
import io
import os
import sys
from pathlib import Path

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent.parent))

REPO_ROOT = Path(__file__).resolve().parents[3]
TEST_IMAGES = REPO_ROOT / "test-images"
ENV_PATH = REPO_ROOT / ".env"


def _load_root_env() -> None:
    if not ENV_PATH.exists():
        return
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


_load_root_env()

OPENROUTER_KEY = os.getenv("BACKUP_OPENAI_API_KEY") or os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE = os.getenv(
    "BACKUP_OPENAI_BASE_URL", "https://openrouter.ai/api/v1"
).rstrip("/")
NEMOTRON_MODEL = os.getenv(
    "BACKUP_OPENAI_MODEL",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
)

pytestmark = pytest.mark.integration

# Images that usually return parseable JSON from Nemotron in manual runs.
NEMOTRON_IMAGE_EXPECTATIONS = {
    "Hamburger.jpg": ["burger", "hamburger", "patty", "beef", "bun"],
    "Chicken-and-Broccoli.jpg": ["chicken", "broccoli"],
    "pizza-slice.jpg": ["pizza"],
    "Eggs-Bacon.jpg": ["egg", "bacon"],
}


def _tiny_png_b64() -> str:
    img = Image.new("RGB", (1, 1), color=(255, 255, 255))
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def _image_b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("utf-8")


@pytest.fixture(scope="module")
def nemotron_analyzer():
    if not OPENROUTER_KEY:
        pytest.skip(
            "Set BACKUP_OPENAI_API_KEY or OPENROUTER_API_KEY to run Nemotron integration tests"
        )

    saved = {k: os.environ.get(k) for k in os.environ if k.startswith(("OPENAI_", "BACKUP_", "LLM_", "NUTRITION_"))}

    os.environ["LLM_PROVIDER"] = "openai"
    os.environ["OPENAI_API_KEY"] = "invalid"
    os.environ["OPENAI_MODEL"] = os.getenv("OPENAI_MODEL", "gemini-3.1-flash-lite")
    os.environ["OPENAI_BASE_URL"] = os.getenv(
        "OPENAI_BASE_URL",
        "https://generativelanguage.googleapis.com/v1beta/openai/",
    )
    os.environ["BACKUP_OPENAI_API_KEY"] = OPENROUTER_KEY
    os.environ["BACKUP_OPENAI_BASE_URL"] = OPENROUTER_BASE
    os.environ["BACKUP_OPENAI_MODEL"] = NEMOTRON_MODEL
    os.environ["NUTRITION_DATA_PROVIDER"] = "local"

    import config
    import nutrition_analyzer

    importlib.reload(config)
    importlib.reload(nutrition_analyzer)

    analyzer = nutrition_analyzer.NutritionAnalyzer()
    assert analyzer.fallback_llm is not None, "Backup LLM did not initialize"
    yield analyzer

    for key, value in saved.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value
    importlib.reload(config)
    importlib.reload(nutrition_analyzer)


def test_backup_llm_initializes(nemotron_analyzer):
    assert nemotron_analyzer.fallback_llm is not None


def test_fallback_analyze_returns_valid_shape(nemotron_analyzer):
    """Primary is invalid; backup must return a parseable NutritionResponse."""
    result = nemotron_analyzer.analyze(_tiny_png_b64())

    assert isinstance(result.foods, list)
    assert result.calories >= 0
    assert result.protein_grams >= 0
    assert result.carbs_grams >= 0
    assert result.fat_grams >= 0
    assert 0.0 <= result.confidence <= 1.0


def test_backup_llm_direct_invoke_returns_content(nemotron_analyzer):
    """Sanity-check the OpenRouter endpoint responds to a multimodal request."""
    from langchain_core.messages import HumanMessage

    message = HumanMessage(
        content=[
            {
                "type": "text",
                "text": (
                    'Reply with JSON only: {"foods":[{"food":"apple","grams":150}],'
                    '"confidence":0.8}'
                ),
            },
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{_tiny_png_b64()}"},
            },
        ]
    )
    response = nemotron_analyzer.fallback_llm.invoke([message])
    assert response.content
    assert "food" in response.content.lower() or "confidence" in response.content.lower()


@pytest.mark.parametrize("img_name,tokens", list(NEMOTRON_IMAGE_EXPECTATIONS.items()))
def test_nemotron_detects_food_in_test_images(nemotron_analyzer, img_name, tokens):
    img_path = TEST_IMAGES / img_name
    if not img_path.exists():
        pytest.skip(f"Test image not found: {img_path}")

    result = nemotron_analyzer.analyze(_image_b64(img_path))

    assert isinstance(result.foods, list)
    assert result.calories >= 0
    foods_text = " ".join(str(f).lower() for f in result.foods)
    assert any(tok in foods_text for tok in tokens), (
        f"Expected one of {tokens} in {result.foods!r} (calories={result.calories})"
    )
