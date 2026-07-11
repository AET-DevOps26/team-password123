"""Headless unit tests for nutrition_analyzer core logic.

No running service, Ollama, or external API required. They exercise the
normalization, JSON parsing, calorie-math pipeline, and nutrition-DB lookup in
isolation using lightweight fakes.

Run with:
    cd services/genai-service
    pytest tests/test_unit.py -v
"""
from __future__ import annotations

import base64
import io
import sys
from pathlib import Path
from typing import Any, Dict

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent.parent))

from nutrition_analyzer import NutritionAnalyzer, NutritionDataClient, NutritionResponse


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_analyzer() -> NutritionAnalyzer:
    """Build a NutritionAnalyzer without touching an LLM or external service."""
    a = NutritionAnalyzer.__new__(NutritionAnalyzer)
    a.provider = "openai"
    a.nutrition_db = NutritionAnalyzer._load_nutrition_db()
    a.nutrition_data = NutritionDataClient(a.nutrition_db, provider="local")
    a.llm = None
    a.fallback_llm = None
    a.text_llm = None
    return a


def _tiny_image_b64() -> str:
    """Return a small PNG as base64 — just enough for the analyze() pipeline."""
    img = Image.new("RGB", (8, 8), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


class _FakeLLM:
    """Stands in for the vision LLM; .invoke() returns a fixed JSON payload.

    analyze() calls self.llm.invoke([...]) directly, so patching this seam lets
    us drive the parse + macro pipeline without a real model.
    """

    def __init__(self, content: str):
        self._content = content

    def invoke(self, _messages):
        return type("FakeLLMResponse", (), {"content": self._content})()


MOCK_NUTRITION: Dict[str, Dict[str, Any]] = {
    "chicken": {
        "calories_per_100g": 165,
        "protein_per_100g": 31,
        "carbs_per_100g": 0,
        "fat_per_100g": 3.6,
        "fiber_per_100g": 0,
    },
    "rice": {
        "calories_per_100g": 130,
        "protein_per_100g": 2.7,
        "carbs_per_100g": 28,
        "fat_per_100g": 0.3,
        "fiber_per_100g": 0.4,
    },
    "broccoli": {
        "calories_per_100g": 34,
        "protein_per_100g": 2.8,
        "carbs_per_100g": 7,
        "fat_per_100g": 0.4,
        "fiber_per_100g": 2.6,
    },
}


# ---------------------------------------------------------------------------
# _normalize_grams
# ---------------------------------------------------------------------------

class TestNormalizeGrams:
    def setup_method(self):
        self.a = _make_analyzer()

    def test_normal_value_unchanged(self):
        assert self.a._normalize_grams("chicken", 150.0) == 150.0

    def test_zero_returns_zero(self):
        assert self.a._normalize_grams("chicken", 0.0) == 0.0

    def test_negative_returns_zero(self):
        assert self.a._normalize_grams("chicken", -10.0) == 0.0

    def test_tiny_non_spice_snapped_to_30(self):
        assert self.a._normalize_grams("chicken", 5.0) == 30.0

    def test_tiny_spice_allowed_below_10(self):
        assert self.a._normalize_grams("cinnamon", 2.0) == 2.0
        assert self.a._normalize_grams("salt", 1.0) == 1.0
        assert self.a._normalize_grams("pepper", 0.5) == 0.5

    def test_above_2000_capped(self):
        assert self.a._normalize_grams("chicken", 5000.0) == 2000.0

    def test_bacon_capped_at_200(self):
        assert self.a._normalize_grams("bacon", 350.0) == 200.0

    def test_egg_capped_at_300(self):
        assert self.a._normalize_grams("egg", 500.0) == 300.0

    def test_pizza_slice_capped_at_400(self):
        assert self.a._normalize_grams("pizza slice", 800.0) == 400.0

    def test_boundary_exactly_at_10_not_snapped(self):
        assert self.a._normalize_grams("chicken", 10.0) == 10.0


# ---------------------------------------------------------------------------
# _parse_response
# ---------------------------------------------------------------------------

class TestParseResponse:
    def setup_method(self):
        self.a = _make_analyzer()

    def test_valid_json(self):
        raw = '{"foods": [{"food": "chicken", "grams": 150}], "confidence": 0.9}'
        foods, conf = self.a._parse_response(raw)
        assert len(foods) == 1
        assert foods[0]["food"] == "chicken"
        assert foods[0]["grams"] == 150.0
        assert conf == pytest.approx(0.9)

    def test_json_in_markdown_fence(self):
        raw = '```json\n{"foods": [{"food": "rice", "grams": 100}], "confidence": 0.8}\n```'
        foods, conf = self.a._parse_response(raw)
        assert len(foods) == 1
        assert foods[0]["food"] == "rice"

    def test_json_in_plain_fence(self):
        raw = '```\n{"foods": [{"food": "broccoli", "grams": 80}], "confidence": 0.7}\n```'
        foods, conf = self.a._parse_response(raw)
        assert len(foods) == 1
        assert foods[0]["food"] == "broccoli"

    def test_multiple_foods(self):
        raw = '{"foods": [{"food": "chicken", "grams": 150}, {"food": "broccoli", "grams": 80}], "confidence": 0.75}'
        foods, conf = self.a._parse_response(raw)
        assert len(foods) == 2
        names = {f["food"] for f in foods}
        assert names == {"chicken", "broccoli"}

    def test_empty_string_returns_empty_with_low_confidence(self):
        foods, conf = self.a._parse_response("")
        assert foods == []
        assert conf == pytest.approx(0.1)

    def test_no_food_visible(self):
        raw = '{"foods": [], "confidence": 0.1}'
        foods, conf = self.a._parse_response(raw)
        assert foods == []

    def test_zero_grams_backfilled_to_typical_portion(self):
        # grams<=0 is no longer dropped at parse time — it's backfilled to a
        # typical portion so the item still contributes to the estimate.
        raw = '{"foods": [{"food": "chicken", "grams": 0}], "confidence": 0.5}'
        foods, _ = self.a._parse_response(raw)
        assert len(foods) == 1
        assert foods[0]["food"] == "chicken"
        assert foods[0]["grams"] > 0

    def test_confidence_clamped_above_1(self):
        raw = '{"foods": [{"food": "rice", "grams": 100}], "confidence": 5.0}'
        _, conf = self.a._parse_response(raw)
        assert conf <= 1.0

    def test_confidence_clamped_below_0(self):
        raw = '{"foods": [{"food": "rice", "grams": 100}], "confidence": -0.5}'
        _, conf = self.a._parse_response(raw)
        assert conf >= 0.0

    def test_default_confidence_when_missing(self):
        raw = '{"foods": [{"food": "rice", "grams": 100}]}'
        _, conf = self.a._parse_response(raw)
        assert 0.0 <= conf <= 1.0

    def test_tiny_grams_normalized(self):
        """Grams < 10 for a non-spice should be snapped to 30 by _normalize_grams."""
        raw = '{"foods": [{"food": "chicken", "grams": 3}], "confidence": 0.6}'
        foods, _ = self.a._parse_response(raw)
        assert foods
        assert foods[0]["grams"] == 30.0


# ---------------------------------------------------------------------------
# analyze() — full pipeline with a fake LLM and mocked nutrition lookup
# ---------------------------------------------------------------------------

class TestAnalyzePipeline:
    def setup_method(self):
        self.a = _make_analyzer()

    def _run(self, llm_json: str) -> NutritionResponse:
        self.a.llm = _FakeLLM(llm_json)
        self.a.fallback_llm = None
        self.a._lookup_food_nutrition = lambda name: MOCK_NUTRITION.get(name.lower())
        return self.a.analyze(_tiny_image_b64())

    def test_single_food_calorie_math(self):
        # 150 g chicken → 150/100 × 165 = 247.5 kcal
        result = self._run('{"foods": [{"food": "chicken", "grams": 150}], "confidence": 0.9}')
        assert result.calories == pytest.approx(247.5)

    def test_single_food_protein_math(self):
        # 150 g chicken → 150/100 × 31 = 46.5 g protein
        result = self._run('{"foods": [{"food": "chicken", "grams": 150}], "confidence": 0.9}')
        assert result.protein_grams == pytest.approx(46.5)

    def test_two_foods_calories_aggregated(self):
        # 100 g chicken (165 kcal) + 100 g rice (130 kcal) = 295 kcal.
        # Macros are summed per-ingredient before the pair is collapsed.
        result = self._run(
            '{"foods": [{"food": "chicken", "grams": 100}, {"food": "rice", "grams": 100}], "confidence": 0.85}'
        )
        assert result.calories == pytest.approx(295.0)

    def test_two_foods_collapsed_into_combined_name(self):
        # Exactly two detected foods are merged into one "<a> and <b>" serving.
        result = self._run(
            '{"foods": [{"food": "chicken", "grams": 100}, {"food": "rice", "grams": 100}], "confidence": 0.85}'
        )
        assert result.foods == ["chicken and rice"]

    def test_unknown_food_contributes_zero_calories(self):
        result = self._run('{"foods": [{"food": "moonrock", "grams": 100}], "confidence": 0.3}')
        assert result.calories == pytest.approx(0.0)

    def test_confidence_passed_through(self):
        result = self._run('{"foods": [{"food": "chicken", "grams": 100}], "confidence": 0.88}')
        assert result.confidence == pytest.approx(0.88)

    def test_empty_foods_returns_zero_macros(self):
        result = self._run('{"foods": [], "confidence": 0.1}')
        assert result.calories == pytest.approx(0.0)
        assert result.protein_grams == pytest.approx(0.0)
        assert result.carbs_grams == pytest.approx(0.0)
        assert result.fat_grams == pytest.approx(0.0)
        assert result.foods == []

    def test_fiber_calculated_correctly(self):
        # 100 g broccoli → 2.6 g fiber
        result = self._run('{"foods": [{"food": "broccoli", "grams": 100}], "confidence": 0.8}')
        assert result.fiber_grams == pytest.approx(2.6)

    def test_llm_and_fallback_none_raises(self):
        self.a.llm = None
        self.a.fallback_llm = None
        with pytest.raises(Exception):
            self.a.analyze(_tiny_image_b64())

    def test_mixed_known_unknown_foods(self):
        # known: rice 100 g (130 kcal) + unknown: xyz 100 g (0 kcal)
        result = self._run(
            '{"foods": [{"food": "rice", "grams": 100}, {"food": "xyz", "grams": 100}], "confidence": 0.6}'
        )
        assert result.calories == pytest.approx(130.0)


# ---------------------------------------------------------------------------
# NutritionDataClient — caching and lookup behaviour
# ---------------------------------------------------------------------------

class TestNutritionDataClient:
    LOCAL_DB = {
        "apple": {
            "calories_per_100g": 52,
            "protein_per_100g": 0.3,
            "carbs_per_100g": 14,
            "fat_per_100g": 0.2,
            "fiber_per_100g": 2.4,
        },
        "banana": {
            "calories_per_100g": 89,
            "protein_per_100g": 1.1,
            "carbs_per_100g": 23,
            "fat_per_100g": 0.3,
            "fiber_per_100g": 2.6,
        },
    }

    def _client(self) -> NutritionDataClient:
        return NutritionDataClient(dict(self.LOCAL_DB), provider="local")

    def test_exact_match(self):
        result = self._client().lookup("apple")
        assert result is not None
        assert result["calories_per_100g"] == 52

    def test_whitespace_normalized(self):
        assert self._client().lookup("  apple  ") is not None

    def test_unknown_food_returns_none(self):
        assert self._client().lookup("unicorn steak") is None

    def test_partial_match(self):
        assert self._client().lookup("green apple") is not None

    def test_case_insensitive(self):
        assert self._client().lookup("Apple") is not None

    def test_cache_hit_on_second_call(self):
        client = self._client()
        client.lookup("apple")
        # Remove the backing store — result must now come from cache
        client.local_fallback = {}
        result = client.lookup("apple")
        assert result is not None
        assert result["calories_per_100g"] == 52

    def test_empty_string_returns_none(self):
        assert self._client().lookup("") is None

    def test_all_macro_fields_present(self):
        result = self._client().lookup("banana")
        assert result is not None
        for field in ["calories_per_100g", "protein_per_100g", "carbs_per_100g", "fat_per_100g", "fiber_per_100g"]:
            assert field in result
