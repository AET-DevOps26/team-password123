#!/usr/bin/env python3
"""Analyze images using Ollama + USDA and print per-image nutrition estimates.

Requires env vars:
  - USDA_FDC_API_KEY
  - LLM_PROVIDER (set to 'ollama')

This script prints JSON array of results.
"""
import sys
from pathlib import Path
import base64
import json

# Ensure repo root is on path
root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(root / 'services' / 'genai-service'))

from nutrition_analyzer import NutritionAnalyzer


def encode_image(path: Path) -> str:
    data = path.read_bytes()
    return base64.b64encode(data).decode('utf-8')


def main():
    images_dir = Path(__file__).resolve().parents[3] / 'test-images'
    if not images_dir.exists():
        print(json.dumps({'error': f'test-images directory not found: {images_dir}'}))
        raise SystemExit(1)

    try:
        analyzer = NutritionAnalyzer()
    except Exception as exc:
        print(json.dumps({'error': 'Failed to initialize NutritionAnalyzer', 'detail': str(exc)}))
        raise SystemExit(1)

    results = []
    for img_path in sorted(images_dir.iterdir()):
        if not img_path.is_file():
            continue
        try:
            img_b64 = encode_image(img_path)
            # Invoke the provider directly to capture raw LLM response for debugging
            llm_resp = analyzer._invoke_provider(img_b64, 'ollama')
            raw = getattr(llm_resp, 'content', None) if llm_resp else None
            parsed_foods, confidence = analyzer._parse_response(raw or "")

            if parsed_foods:
                calories, protein, carbs, fat, fiber = analyzer._calculate_macros_from_foods(parsed_foods)
            else:
                calories = protein = carbs = fat = fiber = 0.0

            results.append({
                'image': img_path.name,
                'provider': 'ollama',
                'calories': calories,
                'protein_grams': protein,
                'carbs_grams': carbs,
                'fat_grams': fat,
                'fiber_grams': fiber,
                'foods': [item.get('food') for item in parsed_foods],
                'confidence': confidence,
                'raw_llm_response': raw,
            })
        except Exception as exc:
            results.append({'image': img_path.name, 'error': str(exc)})

    # Ensure outputs directory exists and save results
    out_dir = Path(__file__).resolve().parents[1] / 'outputs'
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / 'ollama_usda_results.json'
    with out_file.open('w', encoding='utf-8') as fh:
        json.dump(results, fh, indent=2)

    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    main()
