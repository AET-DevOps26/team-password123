#!/usr/bin/env python3
"""Clean nutrition_db.json by replacing branded third-party entries with generic USDA-backed ones.

This script is intentionally conservative:
- It targets common foods that were giving obviously wrong calorie estimates.
- It prefers USDA lookups.
- It falls back to a small set of generic values only when USDA lookup does not produce a plausible result.

Usage:
  python scripts/cleanup_nutrition_db.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from nutrition_analyzer import NutritionDataClient, _normalize_food_name

DB_PATH = ROOT / "nutrition_db.json"

# Query order is from most specific to least specific.
QUERY_MAP: dict[str, list[str]] = {
    "chicken": ["chicken breast", "chicken"],
    "broccoli": ["broccoli"],
    "eggs": ["egg", "eggs"],
    "bacon": ["bacon"],
    "banana": ["banana"],
    "blueberry": ["blueberry", "blueberries"],
    "cinnamon": ["cinnamon"],
    "oatmeal": ["oats", "oatmeal"],
    "pizza": ["pizza", "pizza slice"],
    "hamburger": ["ground beef", "hamburger"],
    "salad": ["green salad", "mixed salad", "salad"],
    "beans": ["beans", "baked beans"],
}

# Conservative fallback values for a few high-risk items when USDA doesn't yield a plausible result.
FALLBACKS: dict[str, dict[str, Any]] = {
    "broccoli": {
        "name": "Broccoli",
        "calories_per_100g": 34,
        "protein_per_100g": 2.8,
        "carbs_per_100g": 6.6,
        "fat_per_100g": 0.4,
        "fiber_per_100g": 2.6,
        "source": "generic_fallback",
    },
    "banana": {
        "name": "Banana",
        "calories_per_100g": 89,
        "protein_per_100g": 1.1,
        "carbs_per_100g": 22.8,
        "fat_per_100g": 0.3,
        "fiber_per_100g": 2.6,
        "source": "generic_fallback",
    },
    "blueberry": {
        "name": "Blueberries",
        "calories_per_100g": 57,
        "protein_per_100g": 0.7,
        "carbs_per_100g": 14.5,
        "fat_per_100g": 0.3,
        "fiber_per_100g": 2.4,
        "source": "generic_fallback",
    },
    "cinnamon": {
        "name": "Cinnamon",
        "calories_per_100g": 247,
        "protein_per_100g": 4.0,
        "carbs_per_100g": 80.6,
        "fat_per_100g": 1.2,
        "fiber_per_100g": 53.1,
        "source": "generic_fallback",
    },
    "oatmeal": {
        "name": "Oats",
        "calories_per_100g": 389,
        "protein_per_100g": 16.9,
        "carbs_per_100g": 66.3,
        "fat_per_100g": 6.9,
        "fiber_per_100g": 10.6,
        "source": "generic_fallback",
    },
    "pizza": {
        "name": "Pizza",
        "calories_per_100g": 266,
        "protein_per_100g": 11,
        "carbs_per_100g": 33,
        "fat_per_100g": 10,
        "fiber_per_100g": 2.5,
        "source": "generic_fallback",
    },
    "bacon": {
        "name": "Bacon",
        "calories_per_100g": 541,
        "protein_per_100g": 37,
        "carbs_per_100g": 1.4,
        "fat_per_100g": 42,
        "fiber_per_100g": 0,
        "source": "generic_fallback",
    },
    "beans": {
        "name": "Cooked Beans",
        "calories_per_100g": 127,
        "protein_per_100g": 8.7,
        "carbs_per_100g": 22.8,
        "fat_per_100g": 0.5,
        "fiber_per_100g": 6.4,
        "source": "generic_fallback",
    },
    "chicken": {
        "name": "Chicken Breast",
        "calories_per_100g": 165,
        "protein_per_100g": 31,
        "carbs_per_100g": 0,
        "fat_per_100g": 3.6,
        "fiber_per_100g": 0,
        "source": "generic_fallback",
    },
    "eggs": {
        "name": "Egg",
        "calories_per_100g": 155,
        "protein_per_100g": 13,
        "carbs_per_100g": 1.1,
        "fat_per_100g": 11,
        "fiber_per_100g": 0,
        "source": "generic_fallback",
    },
    "hamburger": {
        "name": "Hamburger/Ground Beef",
        "calories_per_100g": 217,
        "protein_per_100g": 26,
        "carbs_per_100g": 0,
        "fat_per_100g": 11,
        "fiber_per_100g": 0,
        "source": "generic_fallback",
    },
    "salad": {
        "name": "Mixed Salad (with dressing estimate)",
        "calories_per_100g": 80,
        "protein_per_100g": 2.5,
        "carbs_per_100g": 4,
        "fat_per_100g": 6,
        "fiber_per_100g": 1.5,
        "source": "generic_fallback",
    },
}


def _plausible(entry: dict[str, Any], key: str) -> bool:
    calories = float(entry.get("calories_per_100g") or 0.0)
    if calories <= 0:
        return False

    # Generic food items should not look like ultra-processed branded products.
    if key in {"banana", "blueberry", "cinnamon", "oatmeal", "broccoli"}:
        return calories <= 250
    if key in {"chicken", "eggs", "hamburger", "salad", "pizza", "beans", "bacon"}:
        return calories <= 700
    return calories <= 700


def _pick_usda(client: NutritionDataClient, key: str) -> dict[str, Any] | None:
    for query in QUERY_MAP.get(key, [key]):
        result = client._lookup_usda(query, _normalize_food_name(query))
        if result and _plausible(result, key):
            result["name"] = result.get("name") or query
            result["source"] = "usda"
            return result
    return None


def _compact(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": entry.get("name"),
        "calories_per_100g": float(entry.get("calories_per_100g") or 0.0),
        "protein_per_100g": float(entry.get("protein_per_100g") or 0.0),
        "carbs_per_100g": float(entry.get("carbs_per_100g") or 0.0),
        "fat_per_100g": float(entry.get("fat_per_100g") or 0.0),
        "fiber_per_100g": float(entry.get("fiber_per_100g") or 0.0),
        "source": entry.get("source"),
    }


def main() -> None:
    db = json.loads(DB_PATH.read_text(encoding="utf-8"))
    client = NutritionDataClient(db, provider="usda")
    client.allow_persist = False

    changed: list[str] = []
    for key, fallback in FALLBACKS.items():
        new_entry = _pick_usda(client, key)
        if new_entry is None:
            new_entry = fallback
        db[key] = _compact(new_entry)
        changed.append(key)

    # Also clean a few exact branded entries if they remain suspicious.
    for key in ["banana", "blueberry", "cinnamon", "oatmeal", "pizza", "bacon", "beans", "broccoli", "chicken", "eggs", "hamburger", "salad"]:
        entry = db.get(key)
        if not entry:
            continue
        source = str(entry.get("source") or "").lower()
        cal = float(entry.get("calories_per_100g") or 0.0)
        if source not in {"usda", "excel_import", "generic_fallback", "local"} and cal > 250:
            replacement = _pick_usda(client, key)
            if replacement:
                db[key] = _compact(replacement)
                changed.append(key)

    DB_PATH.write_text(json.dumps(db, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Updated {len(set(changed))} keys in {DB_PATH}")
    print(", ".join(sorted(set(changed))))


if __name__ == "__main__":
    main()
