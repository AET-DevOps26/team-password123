"""Retrieval-quality eval for the health-insight RAG.

Separates "built a RAG" from "engineered a RAG": it measures whether the
embedding space actually retrieves the right HealthFact, rather than only
checking the fail-soft plumbing (that's test_insight.py's job).

Method — known-item retrieval, no Weaviate needed:
  1. Embed every fact's `text` with the real EmbeddingProvider (fastembed local).
  2. For each fact, build a query from its *metadata* (foods/nutrients/food_groups
     /tags) — deliberately NOT its own text — and embed that.
  3. Rank all facts by cosine similarity to the query; record the rank of the
     source fact. Report recall@1, recall@5, and MRR over the whole corpus.

Run standalone for the demo table:  python -m pytest tests/test_rag_eval.py -s -v
or:                                  python tests/test_rag_eval.py

Self-skips when fastembed can't load its model (e.g. offline CI), so it never
turns the pipeline red for an environment reason.
"""

from __future__ import annotations

import numpy as np
import pytest

from health_rag import EmbeddingProvider, load_health_facts

# Recall@5 floor. bge-small on this 100-fact corpus clears this comfortably;
# a real regression (wrong model, broken query builder) drops well below it.
RECALL_AT_5_FLOOR = 0.70
TOP_K = 5


def _query_from_metadata(fact: dict) -> str:
    """A natural-language query from a fact's metadata only (never its text), so
    retrieving the source fact is a genuine text<->concept match, not an echo."""
    parts = (
        fact.get("foods", [])
        + fact.get("nutrients", [])
        + fact.get("food_groups", [])
        + fact.get("tags", [])
    )
    return ", ".join(str(p) for p in parts if p)


def _embed_corpus():
    """Embed fact texts + metadata queries. Returns (facts, doc_matrix, query_matrix)
    or skips the test if the embedding model is unavailable."""
    facts = [f for f in load_health_facts() if _query_from_metadata(f)]
    embedder = EmbeddingProvider()  # local fastembed by default
    try:
        doc_vecs = embedder.embed([f.get("text", "") for f in facts])
        query_vecs = embedder.embed([_query_from_metadata(f) for f in facts])
    except Exception as exc:  # model download blocked / provider misconfigured
        pytest.skip(f"embedding model unavailable: {exc}")
    docs = _l2_normalize(np.array(doc_vecs, dtype=np.float64))
    queries = _l2_normalize(np.array(query_vecs, dtype=np.float64))
    return facts, docs, queries


def _l2_normalize(m: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(m, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return m / norms


def _evaluate(facts, docs, queries):
    """Cosine-rank every query against all docs; return (recall@1, recall@5, MRR)."""
    sims = queries @ docs.T  # (N, N) cosine similarities (rows already normalized)
    hits1 = hits5 = 0
    reciprocal_ranks = 0.0
    n = len(facts)
    for i in range(n):
        # Descending rank of doc i for query i (argsort of -sims).
        order = np.argsort(-sims[i])
        rank = int(np.where(order == i)[0][0]) + 1  # 1-indexed
        hits1 += rank == 1
        hits5 += rank <= TOP_K
        reciprocal_ranks += 1.0 / rank
    return hits1 / n, hits5 / n, reciprocal_ranks / n


def test_rag_retrieval_recall():
    facts, docs, queries = _embed_corpus()
    recall1, recall5, mrr = _evaluate(facts, docs, queries)
    print(
        f"\nRAG retrieval eval over {len(facts)} facts "
        f"(model=bge-small, top_k={TOP_K}):\n"
        f"  recall@1 = {recall1:.2%}\n"
        f"  recall@5 = {recall5:.2%}\n"
        f"  MRR      = {mrr:.3f}"
    )
    assert recall5 >= RECALL_AT_5_FLOOR, (
        f"recall@5 {recall5:.2%} below floor {RECALL_AT_5_FLOOR:.0%} — retrieval "
        "quality regressed (embedding model or query builder changed?)"
    )


if __name__ == "__main__":
    _facts, _docs, _queries = _embed_corpus()
    _r1, _r5, _mrr = _evaluate(_facts, _docs, _queries)
    print(f"facts={len(_facts)} recall@1={_r1:.2%} recall@5={_r5:.2%} MRR={_mrr:.3f}")
