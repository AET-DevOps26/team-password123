"""Unit tests for name-based estimation: dense-food lookup + typical portions.

Mirrors the import style of test_nutrition_lookup.py. Requires the service deps
(pydantic, langchain, PIL) to be installed — runs in a genai venv / CI python job.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from nutrition_analyzer import NutritionAnalyzer, NutritionDataClient, _typical_portion


def make_client() -> NutritionDataClient:
    return NutritionDataClient(NutritionAnalyzer._load_nutrition_db(), provider="local")


def test_calorie_dense_foods_keep_their_own_values():
    """Regression for the >400 kcal heuristic: an EXACT curated-DB key must be
    returned verbatim, never swapped for a lower-calorie substring match."""
    client = make_client()
    # (food, minimum acceptable kcal/100g) — well below each food's real value but
    # far above the low-cal substitutes the old heuristic produced.
    floors = {
        "lard": 800,        # 900
        "mayonnaise": 600,  # 680
        "peanuts": 500,     # 567
        "bacon": 500,       # 541
        "parmesan": 400,    # 431
        "cheddar": 400,     # 403
    }
    for food, floor in floors.items():
        entry = client.lookup(food)
        assert entry is not None, f"{food} missing from the curated DB"
        kcal = entry["calories_per_100g"]
        assert kcal >= floor, (
            f"{food} resolved to {kcal} kcal/100g (< {floor}); the exact key was "
            "wrongly swapped for a low-calorie substring match"
        )


def test_typical_portion_avoids_false_substring_hits():
    # An exact known key resolves to its specific portion.
    assert _typical_portion("muffin") == (113, "1 muffin")
    # 'ham' must NOT fuzzy-match 'hamburger' -> falls through to the default.
    assert _typical_portion("ham") == (100.0, "100 g")
    # 'egg' must NOT fuzzy-match inside 'eggplant'.
    assert _typical_portion("eggplant") == (100.0, "100 g")
    # Unknown food -> default.
    assert _typical_portion("zzzznotafood") == (100.0, "100 g")
