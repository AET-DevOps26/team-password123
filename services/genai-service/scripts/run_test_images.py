"""Run all repo/test-images through NutritionAnalyzer and print results."""
from __future__ import annotations

import base64
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
ENV_PATH = ROOT / ".env"
IMG_DIR = ROOT / "test-images"


def load_env() -> None:
    if not ENV_PATH.exists():
        return
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ[key.strip()] = value.strip()


def main() -> int:
    load_env()
    os.environ.setdefault("NUTRITION_DATA_PROVIDER", "local")

    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from nutrition_analyzer import NutritionAnalyzer

    images = sorted(
        p
        for p in IMG_DIR.iterdir()
        if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    )
    if not images:
        print(f"No images found in {IMG_DIR}")
        return 1

    print("Model: Nemotron backup (Gemini disabled when OPENAI_API_KEY=invalid)")
    print(f"Images: {len(images)}")
    print("=" * 80)

    analyzer = NutritionAnalyzer()
    results = []

    for img_path in images:
        b64 = base64.b64encode(img_path.read_bytes()).decode()
        t0 = time.time()
        try:
            result = analyzer.analyze(b64)
            elapsed = time.time() - t0
            row = {
                "file": img_path.name,
                "ok": True,
                "seconds": round(elapsed, 1),
                "foods": result.foods,
                "calories": round(result.calories, 1),
                "protein": round(result.protein_grams, 1),
                "carbs": round(result.carbs_grams, 1),
                "fat": round(result.fat_grams, 1),
                "fiber": round(result.fiber_grams, 1),
                "confidence": round(result.confidence, 2),
            }
        except Exception as exc:
            elapsed = time.time() - t0
            row = {
                "file": img_path.name,
                "ok": False,
                "seconds": round(elapsed, 1),
                "error": str(exc),
            }
        results.append(row)

        if row["ok"]:
            print(
                f"{row['file']}: {row['seconds']}s"
                f" | foods={row['foods']}"
                f" | {row['calories']} cal"
                f" (P{row['protein']}/C{row['carbs']}/F{row['fat']})"
                f" | conf={row['confidence']}"
            )
        else:
            print(f"{row['file']}: FAILED ({row['seconds']}s) — {row['error']}")

    print("=" * 80)
    ok = sum(1 for r in results if r["ok"])
    with_food = sum(1 for r in results if r.get("ok") and r.get("foods"))
    print(f"Summary: {ok}/{len(results)} succeeded, {with_food}/{len(results)} detected food")
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
