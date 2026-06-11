"""Integration tests for images in repo/test-images.

These tests POST images to the running genai-service and assert a numeric
`calories` and that at least one expected food name appears in the `foods` list.

Run with: pytest services/genai-service/tests/test_image_expectations.py -q
"""
import os
import io
import requests
import pytest
from pathlib import Path

BASE_URL = os.getenv("GENAI_SERVICE_URL", "http://localhost:8084")


@pytest.fixture(scope="session")
def service_is_running():
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        assert r.status_code == 200
    except Exception as e:
        pytest.skip(f"Service not running at {BASE_URL}: {e}")


# Mapping of image filename -> list of expected tokens to find in detected foods
EXPECTED = {
    "Hamburger.jpg": ["burger", "hamburger"],
    "Chicken-and-Broccoli.jpg": ["chicken", "broccoli"],
    "Chili-beans.jpg": ["chili", "beans", "chili beans"],
    "Italian-Chopped-Salad.jpg": ["salad", "italian", "chopped"],
}


def analyze_image(image_path: Path):
    with image_path.open("rb") as fh:
        files = {"file": (image_path.name, fh, "image/jpeg")}
        return requests.post(f"{BASE_URL}/api/analyze", files=files, timeout=60)


@pytest.mark.parametrize("img_name", list(EXPECTED.keys()))
def test_image_has_expected_food_and_calories(service_is_running, img_name):
    repo_root = Path(__file__).resolve().parents[3]
    img_path = repo_root / "test-images" / img_name
    assert img_path.exists(), f"Test image not found: {img_path}"

    resp = analyze_image(img_path)
    assert resp.status_code == 200, f"Unexpected status: {resp.status_code} {resp.text}"
    data = resp.json()

    # Basic structure
    assert "calories" in data, "Missing calories"
    assert isinstance(data["calories"], (int, float)), "Calories is not numeric"
    assert data["calories"] >= 0, "Calories should be non-negative"

    assert "foods" in data and isinstance(data["foods"], list), "Missing foods list"
    # Support both flat lists of strings and lists-of-lists returned by some models
    flat_foods = []
    for item in data["foods"]:
        if isinstance(item, (list, tuple)):
            flat_foods.extend([str(x).lower() for x in item])
        else:
            flat_foods.append(str(item).lower())
    foods_text = " ".join(flat_foods)

    # Expect at least one expected token to appear in the combined foods text
    tokens = EXPECTED[img_name]
    matches = any(tok in foods_text for tok in tokens)
    assert matches, f"None of expected tokens {tokens} found in detected foods: {data['foods']}"
