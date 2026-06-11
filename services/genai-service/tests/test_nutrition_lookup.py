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
    analyzer.provider = "ollama"
    analyzer.nutrition_db = NutritionAnalyzer._load_nutrition_db()
    analyzer.fallback_llm = None
    analyzer.llm = None

    responses = {
        "ollama": '{"foods": [{"food": "chicken", "grams": 100}], "confidence": 0.9}',
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

    assert comparison.primary.provider == "ollama"
    assert comparison.secondary.provider == "google"
    assert comparison.primary.calories == 165
    assert comparison.secondary.calories == 130
    assert comparison.calorie_difference == 35