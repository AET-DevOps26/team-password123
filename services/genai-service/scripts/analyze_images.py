import json
from pathlib import Path
import requests

# Locate repo root (three parents up from this file)
repo_root = Path(__file__).resolve().parents[3]
images_dir = repo_root / 'test-images'
output_file = Path(__file__).resolve().parent / 'analysis_results.json'

BASE_URL = 'http://localhost:8084'

results = {}

if not images_dir.exists():
    print(f"Images folder not found: {images_dir}")
    raise SystemExit(1)

for img_path in sorted(images_dir.iterdir()):
    if not img_path.is_file():
        continue
    print(f"Analyzing {img_path.name}...")
    try:
        with img_path.open('rb') as f:
            files = {'file': (img_path.name, f, 'image/jpeg')}
            resp = requests.post(f"{BASE_URL}/api/analyze", files=files, timeout=60)
        try:
            data = resp.json()
        except Exception:
            data = {'status_code': resp.status_code, 'text': resp.text}
        results[img_path.name] = data
        print(f"-> {img_path.name}: status {resp.status_code}")
    except Exception as e:
        results[img_path.name] = {'error': str(e)}
        print(f"-> {img_path.name}: ERROR {e}")

# Save results
with output_file.open('w', encoding='utf-8') as out:
    json.dump(results, out, indent=2, ensure_ascii=False)

print(f"Saved results to {output_file}")
print(json.dumps({k: (v.get('confidence') if isinstance(v, dict) else None) for k,v in results.items()}, indent=2))