#!/usr/bin/env python
"""Debug script to capture raw API responses"""
import json
from pathlib import Path
import requests
import sys

# Locate repo root
repo_root = Path(__file__).resolve().parents[3]
images_dir = repo_root / 'test-images'
output_file = Path(__file__).resolve().parent / 'raw_responses.json'

BASE_URL = 'http://localhost:8084'

raw_responses = {}

if not images_dir.exists():
    print(f"Images folder not found: {images_dir}")
    raise SystemExit(1)

# Test just the first image
for img_path in sorted(images_dir.iterdir())[:1]:
    if not img_path.is_file():
        continue
    print(f"Analyzing {img_path.name}...")
    try:
        with img_path.open('rb') as f:
            files = {'file': (img_path.name, f, 'image/jpeg')}
            resp = requests.post(f"{BASE_URL}/api/analyze", files=files, timeout=60)
        
        raw_responses[img_path.name] = {
            'status': resp.status_code,
            'response': resp.json() if resp.status_code == 200 else resp.text
        }
        print(f"-> Status: {resp.status_code}")
        print(f"-> Response: {json.dumps(raw_responses[img_path.name]['response'], indent=2)}")
    except Exception as e:
        raw_responses[img_path.name] = {'error': str(e)}
        print(f"-> ERROR: {e}")

# Save
with output_file.open('w', encoding='utf-8') as out:
    json.dump(raw_responses, out, indent=2, ensure_ascii=False)

print(f"\nSaved to {output_file}")
