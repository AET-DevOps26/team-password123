#!/usr/bin/env python3
"""Import nutrition entries from an Excel (.xlsx) file into nutrition_db.json.

Usage:
  python scripts/import_excel_nutrition.py /path/to/Calories\ per\ 100\ grams\ of\ food.xlsx

Behavior:
- Tries to find columns that look like 'food', 'name' for the item name and
  'calori' or 'kcal' for calories per 100g. Also picks protein/carbs/fat/fiber
  columns if present.
- Normalizes names with the project's `_normalize_food_name` function.
- Merges entries into services/genai-service/nutrition_db.json, preserving existing entries.

Note: requires `openpyxl`. Install with `pip install openpyxl` if missing.
"""
from pathlib import Path
import sys
import json
import re

try:
    import openpyxl
except Exception as e:
    print("openpyxl is required. Install via: pip install openpyxl")
    raise SystemExit(1)

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "nutrition_db.json"

# Reuse the normalize helper from nutrition_analyzer if available
try:
    from nutrition_analyzer import _normalize_food_name
except Exception:
    def _normalize_food_name(name: str) -> str:
        return re.sub(r"\s+", " ", name.lower().strip())


def find_best_column(headers, keywords):
    keys = [h.lower() for h in headers]
    for kw in keywords:
        for i, h in enumerate(keys):
            if kw in h:
                return i
    return None


def parse_workbook(path: Path) -> dict:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheet = wb.active

    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return {}

    headers = [str(c) if c is not None else "" for c in rows[0]]
    name_idx = find_best_column(headers, ["food", "name", "item", "ingredient"]) or 0
    cal_idx = find_best_column(headers, ["calori", "kcal", "energy"]) or None
    protein_idx = find_best_column(headers, ["protein"]) or None
    carbs_idx = find_best_column(headers, ["carb"]) or None
    fat_idx = find_best_column(headers, ["fat"]) or None
    fiber_idx = find_best_column(headers, ["fiber"]) or None

    entries = {}
    for r in rows[1:]:
        try:
            name = r[name_idx] if name_idx is not None else None
            if not name:
                continue
            name = str(name).strip()
            norm = _normalize_food_name(name)
            entry = {}
            if cal_idx is not None and cal_idx < len(r):
                try:
                    entry["calories_per_100g"] = float(r[cal_idx])
                except Exception:
                    pass
            if protein_idx is not None and protein_idx < len(r):
                try:
                    entry["protein_per_100g"] = float(r[protein_idx])
                except Exception:
                    pass
            if carbs_idx is not None and carbs_idx < len(r):
                try:
                    entry["carbs_per_100g"] = float(r[carbs_idx])
                except Exception:
                    pass
            if fat_idx is not None and fat_idx < len(r):
                try:
                    entry["fat_per_100g"] = float(r[fat_idx])
                except Exception:
                    pass
            if fiber_idx is not None and fiber_idx < len(r):
                try:
                    entry["fiber_per_100g"] = float(r[fiber_idx])
                except Exception:
                    pass

            # Only save if there's at least one numeric value
            if entry:
                entry.setdefault("name", name)
                entry.setdefault("source", "excel_import")
                entries[norm] = entry
        except Exception:
            continue

    return entries


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/import_excel_nutrition.py /path/to/file.xlsx")
        raise SystemExit(1)

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"File not found: {path}")
        raise SystemExit(1)

    new_entries = parse_workbook(path)
    if not new_entries:
        print("No nutrition entries found in workbook.")
        raise SystemExit(0)

    db = {}
    if DB_PATH.exists():
        try:
            db = json.loads(DB_PATH.read_text(encoding="utf-8"))
        except Exception:
            db = {}

    merged = 0
    for k, v in new_entries.items():
        if k in db:
            # merge numeric fields only if db is missing them
            for fk in ["calories_per_100g", "protein_per_100g", "carbs_per_100g", "fat_per_100g", "fiber_per_100g"]:
                if fk in v and (fk not in db[k] or not db[k].get(fk)):
                    db[k][fk] = v[fk]
            # keep existing name/source unless absent
            db[k].setdefault("name", v.get("name"))
            db[k].setdefault("source", v.get("source", db[k].get("source")))
        else:
            db[k] = v
            merged += 1

    DB_PATH.write_text(json.dumps(db, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Merged {merged} new entries into {DB_PATH}")


if __name__ == "__main__":
    main()
