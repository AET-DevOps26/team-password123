"""Unit tests for nutrition lookup behavior."""

import sys
from pathlib import Path

# Add parent directory to path so we can import nutrition_analyzer
sys.path.insert(0, str(Path(__file__).parent.parent))

from nutrition_analyzer import NutritionAnalyzer


def make_analyzer() -> NutritionAnalyzer:
    """Construct a minimal analyzer with just the lookup table loaded."""
    analyzer = NutritionAnalyzer.__new__(NutritionAnalyzer)
    analyzer.nutrition_db = NutritionAnalyzer._load_nutrition_db()
    return analyzer


def test_nutrition_db_contains_expected_entries():
    """Verify lookup table has required food entries."""
    analyzer = make_analyzer()

    assert "chicken" in analyzer.nutrition_db
    assert "broccoli" in analyzer.nutrition_db
    assert "rice" in analyzer.nutrition_db

    assert analyzer.nutrition_db["chicken"]["calories_per_100g"] == 165
    assert analyzer.nutrition_db["broccoli"]["calories_per_100g"] == 34
    assert analyzer.nutrition_db["rice"]["calories_per_100g"] == 130


def test_lookup_food_nutrition_resolves_known_items():
    """Test direct lookup for known foods."""
    analyzer = make_analyzer()

    chicken = analyzer._lookup_food_nutrition("chicken")
    broccoli = analyzer._lookup_food_nutrition("  broccoli  ")
    rice = analyzer._lookup_food_nutrition("rice")

    assert chicken is not None
    assert broccoli is not None
    assert rice is not None

    assert chicken["protein_per_100g"] == 31
    assert broccoli["fiber_per_100g"] == 2.4
    assert rice["carbs_per_100g"] == 28


def test_lookup_food_nutrition_returns_none_for_unknown_food():
    """Test that unknown foods return None."""
    analyzer = make_analyzer()

    assert analyzer._lookup_food_nutrition("space lasagna") is None
