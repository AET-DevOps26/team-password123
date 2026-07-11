"""Request-size limit middleware: oversized bodies are rejected with 413 before
the analyze endpoints buffer them into memory, capping the memory-exhaustion DoS
(and neutralising the reachable path of the pinned Starlette's multipart CVE).

Requires the service deps (fastapi, langchain, PIL) — runs in the genai CI python
job. TestClient is built without a `with` block on purpose, so the Weaviate-touching
startup event does not run.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient

from app import app, MAX_REQUEST_BYTES

client = TestClient(app)


def test_oversized_body_is_rejected_with_413():
    resp = client.post("/api/analyze", content=b"x" * (MAX_REQUEST_BYTES + 1))
    assert resp.status_code == 413


def test_small_request_passes_the_size_gate():
    # A small body must clear the size gate. Route validation may then 422 (no
    # multipart file), but the point is that the size middleware did not 413 it.
    resp = client.post("/api/analyze", content=b"x" * 100)
    assert resp.status_code != 413


def test_normal_endpoint_still_served():
    assert client.get("/health").status_code == 200
