"""Headless tests for the RAG health-insight endpoint.

No real model download, no real Weaviate, no real LLM: a HealthInsightEngine is
built with a fake embedding provider (fixed-dim vectors), a fake store whose
`search` returns canned facts (or raises, for fail-soft), and a fake text LLM
that returns a canned insight. The engine is injected into the app module.

Mirrors the import style of the other genai tests (sys.path insert).
"""

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent))

import app as app_module  # noqa: E402
from health_rag import HealthInsightEngine  # noqa: E402

CANNED_FACTS = [
    {
        "id": "fiber-legumes-004",
        "text": "Legumes such as beans and lentils are rich in fiber and plant protein.",
        "foods": ["beans", "lentils"],
        "nutrients": ["fiber", "protein"],
        "food_groups": ["legumes"],
        "tags": ["fiber"],
    },
    {
        "id": "whole-grains-group-001",
        "text": "Whole grains retain fiber, minerals, and B vitamins stripped from refined grains.",
        "foods": ["oats", "brown rice"],
        "nutrients": ["fiber"],
        "food_groups": ["whole grains"],
        "tags": ["whole-grains"],
    },
    {
        "id": "carbs-complex-001",
        "text": "Complex carbohydrates give steadier energy than refined carbohydrates.",
        "foods": ["oats", "quinoa"],
        "nutrients": ["carbohydrate"],
        "food_groups": ["whole grains"],
        "tags": ["energy"],
    },
]

CANNED_INSIGHT = (
    "Great protein intake this week from chicken. Your fiber looks a little low, "
    "so adding legumes or whole grains would round things out nicely."
)


class FakeEmbedder:
    """Returns fixed 384-dim vectors without loading any model."""

    dimension = 384

    def embed(self, texts):
        return [[0.01] * self.dimension for _ in texts]


class FakeStore:
    """Stand-in for WeaviateStore; search returns canned facts or raises."""

    def __init__(self, facts=None, raise_on_search=False):
        self._facts = facts if facts is not None else CANNED_FACTS
        self._raise = raise_on_search

    def search(self, vector, top_k):
        if self._raise:
            raise RuntimeError("Weaviate unavailable")
        return self._facts[:top_k]


class FakeLLM:
    """Stand-in for a LangChain chat model; invoke returns a canned message."""

    def __init__(self, content=CANNED_INSIGHT):
        self._content = content

    def invoke(self, _messages):
        return SimpleNamespace(content=self._content)


def make_engine(**kwargs) -> HealthInsightEngine:
    return HealthInsightEngine(
        embedder=FakeEmbedder(),
        store=kwargs.pop("store", FakeStore()),
        text_llm=kwargs.pop("text_llm", FakeLLM()),
    )


@pytest.fixture
def client():
    """A TestClient with the insight engine swapped for a fake.

    Not used as a context manager, so the startup index-build hook never fires
    (no model download, no Weaviate connection)."""
    saved = app_module._insight_engine
    yield TestClient(app_module.app)
    app_module._insight_engine = saved


SAMPLE_BODY = {
    "window": "week",
    "foods": [
        {"name": "chicken breast", "total_grams": 600},
        {"name": "white rice", "total_grams": 800},
    ],
    "nutrient_totals": {"protein": 700, "carbs": 1500, "fat": 350, "fiber": 60},
    "days_logged": 6,
}


def test_insight_success(client):
    app_module._insight_engine = make_engine()

    response = client.post("/api/insight", json=SAMPLE_BODY)

    assert response.status_code == 200
    data = response.json()
    assert data["result"] == "success"
    assert data["insight"] == CANNED_INSIGHT
    assert data["insight"]
    # facts_used reflects the canned facts that were "retrieved".
    used_ids = [f["id"] for f in data["facts_used"]]
    assert used_ids == [f["id"] for f in CANNED_FACTS]
    assert all(f["text"] for f in data["facts_used"])


def test_insight_failsoft_when_search_raises(client):
    # Weaviate down: search raises -> generic profile-only tip, still HTTP 200.
    app_module._insight_engine = make_engine(store=FakeStore(raise_on_search=True))

    response = client.post("/api/insight", json=SAMPLE_BODY)

    assert response.status_code == 200
    data = response.json()
    assert data["result"] == "degraded"
    assert data["facts_used"] == []
    assert data["insight"]  # a generic tip was still produced


def test_insight_failsoft_when_llm_unavailable(client):
    # Retrieval works but no LLM -> top retrieved fact verbatim, degraded, 200.
    app_module._insight_engine = make_engine(text_llm=None)

    response = client.post("/api/insight", json=SAMPLE_BODY)

    assert response.status_code == 200
    data = response.json()
    assert data["result"] == "degraded"
    assert data["insight"] == CANNED_FACTS[0]["text"]
    assert len(data["facts_used"]) == 1
    assert data["facts_used"][0]["id"] == CANNED_FACTS[0]["id"]


def test_insight_minimal_body_defaults(client):
    # Empty body is valid: window defaults to "week", foods default to [].
    app_module._insight_engine = make_engine()

    response = client.post("/api/insight", json={})

    assert response.status_code == 200
    assert response.json()["result"] == "success"


def test_insight_rejects_malformed_food(client):
    # A food missing its required `name` -> 422 validation error.
    app_module._insight_engine = make_engine()

    response = client.post(
        "/api/insight", json={"foods": [{"total_grams": 100}]}
    )

    assert response.status_code == 422


def test_embedding_dimension_guard():
    # The provider exposes the expected dimension without loading a model.
    from health_rag import EmbeddingProvider

    assert EmbeddingProvider(provider="local").dimension == 384
    assert EmbeddingProvider(provider="openai").dimension == 1536


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
