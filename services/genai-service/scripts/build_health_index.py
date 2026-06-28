#!/usr/bin/env python3
"""Build (or refresh) the HealthFact vector index in Weaviate.

Idempotent: loads health_facts.json, embeds each fact with the configured
EMBED_PROVIDER, and upserts the vectors into the HealthFact collection. If the
collection is already populated with a matching embedding dimension the build is
a no-op; on a dimension mismatch it drops and rebuilds.

Usage:
    python scripts/build_health_index.py

Honors the same env vars as the service: WEAVIATE_URL, EMBED_PROVIDER,
EMBED_MODEL_LOCAL / OPENAI_EMBED_MODEL, HEALTH_FACTS_PATH.
"""

import logging
import sys
from pathlib import Path

# scripts/ utilities set up sys.path before importing service modules (E402 is
# ignored for scripts/* in ruff.toml).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import EMBED_PROVIDER, WEAVIATE_URL  # noqa: E402
from health_rag import WeaviateStore, build_index  # noqa: E402

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger("build_health_index")


def main() -> int:
    logger.info("Embedding provider: %s", EMBED_PROVIDER)
    logger.info("Weaviate URL: %s", WEAVIATE_URL)

    store = WeaviateStore()
    try:
        written = build_index(store=store)
    except Exception as exc:
        logger.error("Index build failed: %s", exc)
        return 1
    finally:
        store.close()

    if written == 0:
        logger.info("HealthFact index already up to date (no changes written).")
    else:
        logger.info("Wrote %d HealthFact objects to Weaviate.", written)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
