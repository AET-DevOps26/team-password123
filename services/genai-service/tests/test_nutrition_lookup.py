"""Unit tests for nutrition lookup behavior."""

import base64
import io
import sys
from pathlib import Path

import pytest
from PIL import Image

# Add parent directory to path so we can import nutrition_analyzer
sys.path.insert(0, str(Path(__file__).parent.parent))

import nutrition_analyzer as nutrition_module
from nutrition_analyzer import NutritionAnalyzer, NutritionDataClient


class FakeResponse:
    def __init__(self, payload, ok=True):
        self._payload = payload
        self.ok = ok
        self.status_code = 200 if ok else 500

    def json(self):
        return self._payload

    def raise_for_status(self):
        if not self.ok:
            raise RuntimeError("HTTP error")


class FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)

    def get(self, *args, **kwargs):
        if not self.responses:
            raise AssertionError("Unexpected HTTP call")
        return self.responses.pop(0)


def make_client(provider: str = "auto") -> NutritionDataClient:
    return NutritionDataClient(NutritionAnalyzer._load_nutrition_db(), provider=provider)


def test_local_fallback_still_resolves_known_items():
    client = make_client(provider="local")

    chicken = client.lookup("chicken")
    broccoli = client.lookup("  broccoli  ")
    rice = client.lookup("rice")

    assert chicken is not None
    assert broccoli is not None
    assert rice is not None

    assert chicken["calories_per_100g"] == 165
    assert broccoli["calories_per_100g"] < 100
    assert broccoli["fiber_per_100g"] > 0
    assert rice["carbs_per_100g"] == 28


def test_usda_lookup_parses_nutrients(monkeypatch):
    monkeypatch.setattr(nutrition_module, "USDA_FDC_API_KEY", "test-key")

    search_payload = {
        "foods": [
            {
                "fdcId": 123,
                "description": "Chicken breast, cooked",
                "dataType": "Branded",
            }
        ]
    }
    detail_payload = {
        "dataType": "Branded",
        "servingSize": 100,
        "foodNutrients": [
            {"nutrientNumber": "1008", "nutrientName": "Energy", "unitName": "kcal", "value": 165},
            {"nutrientNumber": "1003", "nutrientName": "Protein", "unitName": "g", "value": 31},
            {"nutrientNumber": "1005", "nutrientName": "Carbohydrate, by difference", "unitName": "g", "value": 0},
            {"nutrientNumber": "1004", "nutrientName": "Total lipid (fat)", "unitName": "g", "value": 3.6},
            {"nutrientNumber": "1079", "nutrientName": "Fiber, total dietary", "unitName": "g", "value": 0},
        ],
    }

    client = make_client(provider="usda")
    client.session = FakeSession([FakeResponse(search_payload), FakeResponse(detail_payload)])

    chicken = client.lookup("chicken breast")

    assert chicken is not None
    assert chicken["source"] == "usda"
    assert chicken["calories_per_100g"] == 165
    assert chicken["protein_per_100g"] == 31
    assert chicken["fat_per_100g"] == 3.6


def test_lookup_food_nutrition_returns_none_for_unknown_food():
    client = make_client(provider="local")
    client.local_fallback = {}

    assert client.lookup("space lasagna") is None


def test_compare_providers_returns_calorie_difference(monkeypatch):
    analyzer = NutritionAnalyzer.__new__(NutritionAnalyzer)
    analyzer.provider = "openai"
    analyzer.nutrition_db = NutritionAnalyzer._load_nutrition_db()
    analyzer.fallback_llm = None
    analyzer.llm = None

    responses = {
        "openai": '{"foods": [{"food": "chicken", "grams": 100}], "confidence": 0.9}',
        "google": '{"foods": [{"food": "rice", "grams": 100}], "confidence": 0.8}',
    }

    class FakeLLM:
        def __init__(self, content):
            self.content = content

        def invoke(self, messages):
            return type("Response", (), {"content": self.content})()

    def fake_build_llm(provider: str):
        return FakeLLM(responses[provider])

    analyzer._build_llm = fake_build_llm
    analyzer._lookup_food_nutrition = lambda food_name: {
        "chicken": {"calories_per_100g": 165, "protein_per_100g": 31, "carbs_per_100g": 0, "fat_per_100g": 3.6, "fiber_per_100g": 0},
        "rice": {"calories_per_100g": 130, "protein_per_100g": 2.7, "carbs_per_100g": 28, "fat_per_100g": 0.3, "fiber_per_100g": 0.4},
    }.get(food_name)

    img = Image.new("RGB", (1, 1), color=(255, 255, 255))
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    comparison = analyzer.compare_providers(image_base64)

    assert comparison.primary.provider == "openai"
    assert comparison.secondary.provider == "google"
    assert comparison.primary.calories == 165
    assert comparison.secondary.calories == 130
    assert comparison.calorie_difference == 35


def _tiny_png_b64() -> str:
    img = Image.new("RGB", (1, 1), color=(255, 255, 255))
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


class _RaisingLLM:
    def __init__(self, exc):
        self._exc = exc

    def invoke(self, messages):
        raise self._exc


def test_analyze_unconfigured_provider_reports_key_not_fallback_error():
    """When the configured provider never initialized (e.g. empty OPENAI_API_KEY),
    the dead backup fallback's connection error must NOT mask the real cause."""
    analyzer = NutritionAnalyzer.__new__(NutritionAnalyzer)
    analyzer.provider = "openai"
    analyzer.llm = None  # provider failed to build — no API key
    analyzer.fallback_llm = _RaisingLLM(OSError("[Errno -2] Name or service not known"))

    with pytest.raises(ValueError) as exc_info:
        analyzer.analyze(_tiny_png_b64())

    msg = str(exc_info.value)
    assert "OPENAI_API_KEY" in msg
    assert "Name or service not known" not in msg


def test_parse_response_drops_placeholder_item():
    analyzer = NutritionAnalyzer.__new__(NutritionAnalyzer)
    foods, conf = analyzer._parse_response(
        '{"foods": [{"food": "item", "grams": 100}, {"food": "chicken", "grams": 150}], "confidence": 0.9}'
    )
    assert len(foods) == 1
    assert foods[0]["food"] == "chicken"
    assert conf == 0.9


def test_parse_response_boosts_confidence_when_foods_found_but_low():
    analyzer = NutritionAnalyzer.__new__(NutritionAnalyzer)
    foods, conf = analyzer._parse_response(
        '{"foods": [{"food": "pizza", "grams": 120}]}'
    )
    assert foods[0]["food"] == "pizza"
    assert conf == 0.6


def test_parse_response_accepts_string_food_list():
    analyzer = NutritionAnalyzer.__new__(NutritionAnalyzer)
    foods, conf = analyzer._parse_response(
        '{"foods": ["oatmeal", "blueberries", "banana"], "confidence": 0.8}'
    )
    names = [f["food"] for f in foods]
    assert "oatmeal" in names
    assert len(foods) >= 2
    assert conf == 0.8


def test_parse_response_salvages_foods_from_reasoning_prose():
    analyzer = NutritionAnalyzer.__new__(NutritionAnalyzer)
    raw = (
        'Let me analyze... {"foods": [], "confidence": 0.1} '
        'but I see {"food": "oatmeal", "grams": 200} and {"food": "banana", "grams": 80}'
    )
    foods, _conf = analyzer._parse_response(raw)
    names = [f["food"] for f in foods]
    assert "oatmeal" in names or "banana" in names


def test_parse_response_salvages_foods_from_pure_reasoning_prose():
    analyzer = NutritionAnalyzer.__new__(NutritionAnalyzer)
    raw = (
        "So, let's look at the burger. The visible edible items are:\n"
        "- Sesame seed bun (top and bottom)\n"
        "- Beef patty\n"
        "- Cheese (melted)\n"
        "- Red onion slices\n"
        "1. Sesame bun: 100g (typical burger bun weight)\n"
        "2. Beef patty: 120g (standard size)\n"
    )
    foods, conf = analyzer._parse_response(raw)
    names = [f["food"].lower() for f in foods]
    assert any("patty" in n or "beef" in n for n in names)
    assert conf >= 0.5


def test_combine_two_foods_if_pair_merges_name_and_portions():
    merged = NutritionAnalyzer._combine_two_foods_if_pair(
        [{"food": "chicken", "grams": 150}, {"food": "broccoli", "grams": 80}]
    )
    assert len(merged) == 1
    assert merged[0]["food"] == "chicken and broccoli"
    assert merged[0]["grams"] == 230


def test_combine_two_foods_if_pair_leaves_other_counts_unchanged():
    items = [{"food": "pizza", "grams": 120}]
    assert NutritionAnalyzer._combine_two_foods_if_pair(items) == items

    items = [{"food": "a", "grams": 50}, {"food": "b", "grams": 40}, {"food": "c", "grams": 30}]
    assert NutritionAnalyzer._combine_two_foods_if_pair(items) == items


def test_build_prompt_discourages_empty_and_placeholders():
    prompt = NutritionAnalyzer._build_prompt()
    assert "Do NOT use placeholder" in prompt
    assert "never return an empty foods list" in prompt


def test_analyze_surfaces_primary_error_over_fallback():
    """A 403 (or any error) from the configured vision provider must surface,
    not be swallowed by the fallback's failure."""
    analyzer = NutritionAnalyzer.__new__(NutritionAnalyzer)
    analyzer.provider = "openai"
    analyzer.llm = _RaisingLLM(RuntimeError("Error code: 403 - PERMISSION_DENIED"))
    analyzer.fallback_llm = _RaisingLLM(OSError("[Errno -2] Name or service not known"))

    with pytest.raises(ValueError) as exc_info:
        analyzer.analyze(_tiny_png_b64())

    msg = str(exc_info.value)
    assert "403" in msg
    assert "Name or service not known" not in msg