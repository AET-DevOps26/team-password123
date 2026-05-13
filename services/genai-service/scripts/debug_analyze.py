#!/usr/bin/env python
"""Debug script to see raw LLM response"""
import sys
sys.path.insert(0, '..')

from nutrition_analyzer import NutritionAnalyzer
from pathlib import Path
import json

analyzer = NutritionAnalyzer()

# Test with first image
test_image = Path("../../test-images/Hamburger.jpg")
print(f"Analyzing {test_image.name}...")
print("=" * 60)

result = analyzer.analyze(test_image)
print(f"Result: {json.dumps(result.model_dump(), indent=2)}")
