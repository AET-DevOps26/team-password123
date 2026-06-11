#!/usr/bin/env python3
"""Populate services/genai-service/nutrition_db.json with nutrition entries from USDA.

Usage:
  Set the USDA_FDC_API_KEY env var, then run:
    python scripts/populate_nutrition_db.py data/top_foods.txt

If `data/top_foods.txt` is provided it should contain one food name per line (ideally ~300 names).
If no file is provided a small default list will be used.

The script uses the existing NutritionDataClient lookup logic to fetch standardized nutrition
values and writes them into services/genai-service/nutrition_db.json as a mapping from
normalized food name -> nutrition dict.

NOTE: This script makes many API calls to USDA; respect their rate limits and your API quota.
"""
from pathlib import Path
import os
import sys
import time
import json

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / 'nutrition_db.json'

USDA_KEY = os.getenv('USDA_FDC_API_KEY')
if not USDA_KEY:
    print('Please set USDA_FDC_API_KEY in your environment and re-run.')
    raise SystemExit(1)

# Import the client from the service
sys.path.insert(0, str(ROOT))
from nutrition_analyzer import NutritionDataClient, _normalize_food_name


def load_food_list(path: Path | None) -> list[str]:
    if path and path.exists():
        with path.open('r', encoding='utf-8') as fh:
            items = [line.strip() for line in fh if line.strip()]
            return items
    # Default small sample when no file provided
    return [
        'banana', 'apple', 'chicken', 'beef', 'pork', 'rice', 'bread', 'milk', 'egg', 'cheese',
        'potato', 'tomato', 'onion', 'garlic', 'butter', 'olive oil', 'broccoli', 'carrot',
        'spinach', 'yogurt', 'oats', 'peanut butter', 'almond', 'salmon', 'tuna', 'shrimp',
        'beans', 'lentils', 'tofu', 'pasta', 'pizza', 'hamburger', 'bacon', 'sausage', 'corn',
        'cucumber', 'lettuce', 'avocado', 'orange', 'strawberry', 'blueberry', 'mushroom',
        'cabbage', 'kale', 'chili', 'honey', 'sugar', 'flour', 'coconut', 'walnut', 'pecan',
    ]


def main():
    file_arg = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    foods = load_food_list(file_arg)
    print(f'Found {len(foods)} foods to process')

    client = NutritionDataClient({}, provider='usda', usda_api_key=USDA_KEY)

    # Load existing DB
    db = {}
    if DB_PATH.exists():
        try:
            db = json.loads(DB_PATH.read_text(encoding='utf-8'))
        except Exception:
            db = {}

    done = 0
    for name in foods:
        norm = _normalize_food_name(name)
        if norm in db:
            print(f'skipping existing: {norm}')
            continue
        print(f'looking up: {name}')
        try:
            info = client.lookup(name)
        except Exception as exc:
            print(f'lookup failed for {name}: {exc}')
            info = None

        if info:
            # store only the core fields
            entry = {
                'calories_per_100g': info.get('calories_per_100g'),
                'protein_per_100g': info.get('protein_per_100g'),
                'carbs_per_100g': info.get('carbs_per_100g'),
                'fat_per_100g': info.get('fat_per_100g'),
                'fiber_per_100g': info.get('fiber_per_100g'),
                'source': info.get('source'),
                'name': info.get('name') or name,
            }
            db[norm] = entry
            done += 1
            # polite pause
            time.sleep(0.3)
        else:
            print(f'no data for: {name}')
            time.sleep(0.2)

    # Write DB
    DB_PATH.write_text(json.dumps(db, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'Wrote {done} new entries to {DB_PATH}')


if __name__ == '__main__':
    main()
