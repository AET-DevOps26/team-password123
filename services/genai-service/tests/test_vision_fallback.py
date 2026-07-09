"""Vision provider tests: Gemini primary, OpenRouter Nemotron backup.

Production wiring:
  - Primary: Gemini via OPENAI_* (Google OpenAI-compatible endpoint)
  - Backup:  Nemotron via BACKUP_OPENAI_* (OpenRouter)

Unit tests (default) mock both providers and verify fallback behaviour without
API keys. Optional integration tests hit the real backup endpoint only — they
are smoke checks for when Gemini is down, not the main vision path.

Run unit tests (CI, no keys):
  pytest tests/test_vision_fallback.py -v -m "not integration"

Run backup smoke tests (needs OPENROUTER_API_KEY; skips on quota 429):
  pytest tests/test_vision_fallback.py -v -m "integration and backup"
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

from nutrition_analyzer import NutritionAnalyzer, NutritionDataClient

REPO_ROOT = Path(__file__).resolve().parents[3]
TEST_IMAGES = REPO_ROOT / "test-images"
ENV_PATH = REPO_ROOT / ".env"

GEMINI_JSON = '{"foods":[{"food":"pizza","grams":120}],"confidence":0.9}'
BACKUP_JSON = '{"foods":[{"food":"chicken","grams":150},{"food":"broccoli","grams":80}],"confidence":0.85}'


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
BACKUP_MODEL = os.getenv(
    "BACKUP_OPENAI_MODEL",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
)


def _tiny_png_b64() -> str:
    img = Image.new("RGB", (1, 1), color=(255, 255, 255))
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def _image_b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("utf-8")


class _FakeLLM:
    """Minimal LLM stub that records invoke calls."""

    def __init__(self, content: str = "", *, exc: Exception | None = None, label: str = "llm"):
        self.content = content
        self.exc = exc
        self.label = label
        self.calls = 0

    def invoke(self, messages):
        self.calls += 1
        if self.exc:
            raise self.exc
        return type("Response", (), {"content": self.content})()


def _analyzer_with_llms(primary: _FakeLLM | None, backup: _FakeLLM | None) -> NutritionAnalyzer:
    analyzer = NutritionAnalyzer.__new__(NutritionAnalyzer)
    analyzer.provider = "openai"
    analyzer.llm = primary
    analyzer.fallback_llm = backup
    analyzer.nutrition_db = NutritionAnalyzer._load_nutrition_db()
    analyzer.nutrition_data = NutritionDataClient(analyzer.nutrition_db, provider="local")
    return analyzer


# ---------------------------------------------------------------------------
# Unit tests — Gemini primary path (mocked, always run in CI)
# ---------------------------------------------------------------------------


def test_analyze_uses_gemini_primary_without_calling_backup():
    """Happy path: Gemini succeeds; Nemotron backup must not be invoked."""
    primary = _FakeLLM(GEMINI_JSON, label="gemini")
    backup = _FakeLLM(BACKUP_JSON, label="nemotron")

    result = _analyzer_with_llms(primary, backup).analyze(_tiny_png_b64())

    assert primary.calls == 1
    assert backup.calls == 0
    assert any("pizza" in food.lower() for food in result.foods)
    assert result.calories > 0
    assert result.vision_model == NutritionAnalyzer._vision_model_label(primary=True)


def test_analyze_falls_back_to_nemotron_when_gemini_fails():
    """When Gemini fails, analyze must call the OpenRouter backup."""
    primary = _FakeLLM(exc=RuntimeError("Error code: 403 - PERMISSION_DENIED"), label="gemini")
    backup = _FakeLLM(BACKUP_JSON, label="nemotron")

    result = _analyzer_with_llms(primary, backup).analyze(_tiny_png_b64())

    assert primary.calls == 1
    assert backup.calls == 1
    foods_text = " ".join(result.foods).lower()
    assert "chicken" in foods_text or "broccoli" in foods_text
    assert result.calories > 0
    assert result.vision_model == NutritionAnalyzer._vision_model_label(primary=False)


def test_gemini_failure_surfaces_when_backup_unreachable():
    """Prod case: Gemini misconfigured and backup endpoint not deployed."""
    primary = _FakeLLM(
        exc=RuntimeError("Error code: 403 - PERMISSION_DENIED"),
        label="gemini",
    )
    backup = _FakeLLM(
        exc=OSError("[Errno -2] Name or service not known"),
        label="nemotron",
    )

    with pytest.raises(ValueError) as exc_info:
        _analyzer_with_llms(primary, backup).analyze(_tiny_png_b64())

    msg = str(exc_info.value)
    assert "403" in msg
    assert "Name or service not known" not in msg


def test_backup_rate_limit_surfaces_when_gemini_also_failed():
    """When both providers fail with API responses, report the backup error."""
    primary = _FakeLLM(exc=RuntimeError("Error code: 400 - invalid key"), label="gemini")
    backup = _FakeLLM(
        exc=RuntimeError(
            "Error code: 429 - Rate limit exceeded: free-models-per-day"
        ),
        label="nemotron",
    )

    with pytest.raises(ValueError) as exc_info:
        _analyzer_with_llms(primary, backup).analyze(_tiny_png_b64())

    msg = str(exc_info.value)
    assert "429" in msg or "rate limit" in msg.lower()


def test_combined_analysis_failure_prefers_primary_when_backup_unreachable():
    msg = NutritionAnalyzer._combined_analysis_failure(
        RuntimeError("403 denied"),
        OSError("[Errno -2] Name or service not known"),
    )
    assert "403" in msg
    assert "Name or service not known" not in msg


def test_combined_analysis_failure_reports_backup_when_it_responded():
    msg = NutritionAnalyzer._combined_analysis_failure(
        RuntimeError("400 invalid key"),
        RuntimeError("429 rate limit"),
    )
    assert "429" in msg
    assert "backup vision analysis failed" in msg


# ---------------------------------------------------------------------------
# Integration — backup smoke only (optional OpenRouter key)
# ---------------------------------------------------------------------------


def _skip_if_openrouter_quota_error(exc: BaseException) -> None:
    seen: set[int] = set()
    current: BaseException | None = exc
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        msg = str(current).lower()
        if (
            "429" in msg
            or "rate limit" in msg
            or "free-models-per-day" in msg
            or "quota" in msg
        ):
            pytest.skip(f"OpenRouter backup quota exhausted — skipping: {current}")
        current = current.__cause__


def _analyze_backup_or_skip(analyzer: NutritionAnalyzer, image_b64: str):
    try:
        return analyzer.analyze(image_b64)
    except ValueError as exc:
        _skip_if_openrouter_quota_error(exc)
        raise


@pytest.fixture(scope="module")
def prod_like_analyzer_without_gemini_key():
    """Prod-like config: Gemini endpoint configured but key absent; backup wired."""
    if not OPENROUTER_KEY:
        pytest.skip(
            "Set OPENROUTER_API_KEY to run backup smoke tests "
            "(Gemini primary is not exercised here)"
        )

    saved = {
        k: os.environ.get(k)
        for k in os.environ
        if k.startswith(("OPENAI_", "BACKUP_", "LLM_", "NUTRITION_"))
    }

    os.environ["LLM_PROVIDER"] = "openai"
    os.environ["OPENAI_API_KEY"] = ""
    os.environ["OPENAI_MODEL"] = os.getenv("OPENAI_MODEL", "gemini-3.1-flash-lite")
    os.environ["OPENAI_BASE_URL"] = os.getenv(
        "OPENAI_BASE_URL",
        "https://generativelanguage.googleapis.com/v1beta/openai/",
    )
    os.environ["BACKUP_OPENAI_API_KEY"] = OPENROUTER_KEY
    os.environ["BACKUP_OPENAI_BASE_URL"] = OPENROUTER_BASE
    os.environ["BACKUP_OPENAI_MODEL"] = BACKUP_MODEL
    os.environ["NUTRITION_DATA_PROVIDER"] = "local"

    import config
    import nutrition_analyzer

    importlib.reload(config)
    importlib.reload(nutrition_analyzer)

    analyzer = nutrition_analyzer.NutritionAnalyzer()
    assert analyzer.llm is None, "Gemini primary must stay unset in backup smoke tests"
    assert analyzer.fallback_llm is not None, "OpenRouter backup must initialize"
    yield analyzer

    for key, value in saved.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value
    importlib.reload(config)
    importlib.reload(nutrition_analyzer)


@pytest.mark.integration
@pytest.mark.backup
def test_backup_llm_initializes_when_gemini_key_missing(prod_like_analyzer_without_gemini_key):
    """Backup is available even when the Gemini primary cannot start."""
    analyzer = prod_like_analyzer_without_gemini_key
    assert analyzer.llm is None
    assert analyzer.fallback_llm is not None


@pytest.mark.integration
@pytest.mark.backup
def test_backup_analyze_returns_valid_shape(prod_like_analyzer_without_gemini_key):
    """Smoke: backup-only analyze returns a parseable response."""
    result = _analyze_backup_or_skip(
        prod_like_analyzer_without_gemini_key, _tiny_png_b64()
    )

    assert isinstance(result.foods, list)
    assert result.calories >= 0
    assert 0.0 <= result.confidence <= 1.0


@pytest.mark.integration
@pytest.mark.backup
def test_backup_detects_food_in_sample_photo(prod_like_analyzer_without_gemini_key):
    """Single photo smoke test for the backup path (not the main Gemini path)."""
    img_path = TEST_IMAGES / "Chicken-and-Broccoli.jpg"
    if not img_path.exists():
        pytest.skip(f"Test image not found: {img_path}")

    result = _analyze_backup_or_skip(
        prod_like_analyzer_without_gemini_key, _image_b64(img_path)
    )

    foods_text = " ".join(str(f).lower() for f in result.foods)
    assert "chicken" in foods_text or "broccoli" in foods_text, (
        f"Expected chicken or broccoli in backup result: {result.foods!r}"
    )
