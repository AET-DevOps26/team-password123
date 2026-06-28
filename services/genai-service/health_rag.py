"""RAG health-insights engine.

Pipeline: embed a profile-derived query -> Weaviate top-k HealthFact search ->
augment a text-LLM prompt with the retrieved facts -> generate a short,
personalized insight. Embeddings are computed in-process (fastembed local, or
OpenAI cloud) and Weaviate is used purely as a bring-your-own-vector store.

Fail-soft is a first-class concern (see HealthInsightEngine.insight):
- Weaviate down/empty  -> generic profile-only tip, result="degraded"
- LLM down (retrieval ok) -> top retrieved fact verbatim, result="degraded"
- everything works     -> generated insight, result="success"
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

from config import (
    EMBED_MODEL_LOCAL,
    EMBED_PROVIDER,
    HEALTH_FACTS_PATH,
    INSIGHT_TOPK,
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    OPENAI_EMBED_MODEL,
    TEXT_OPENAI_API_KEY,
    TEXT_OPENAI_BASE_URL,
    TEXT_OPENAI_MODEL,
    WEAVIATE_URL,
)

logger = logging.getLogger(__name__)

COLLECTION_NAME = "HealthFact"


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------
class EmbeddingProvider:
    """Turns text into vectors. `local` uses fastembed (ONNX, no torch);
    `openai` uses the OpenAI embeddings API.

    The underlying model is lazy-loaded on first `embed()` so importing this
    module stays cheap and tests can inject a fake before any model downloads.
    """

    # Known output dimensions so callers (and the store's dimension guard) can
    # reason about vectors without forcing a model load.
    _LOCAL_DIM = 384  # BAAI/bge-small-en-v1.5
    _OPENAI_DIM = 1536  # text-embedding-3-small

    def __init__(self, provider: str = EMBED_PROVIDER):
        self.provider = provider
        self._model: Any = None  # fastembed.TextEmbedding | OpenAI client

    @property
    def dimension(self) -> int:
        return self._OPENAI_DIM if self.provider == "openai" else self._LOCAL_DIM

    def _ensure_model(self) -> None:
        if self._model is not None:
            return
        if self.provider == "openai":
            from openai import OpenAI

            self._model = OpenAI(
                api_key=OPENAI_API_KEY or None,
                base_url=OPENAI_BASE_URL or None,
            )
        else:
            from fastembed import TextEmbedding

            logger.info("Loading local embedding model %s", EMBED_MODEL_LOCAL)
            self._model = TextEmbedding(model_name=EMBED_MODEL_LOCAL)

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts into a list of float vectors."""
        if not texts:
            return []
        self._ensure_model()

        if self.provider == "openai":
            response = self._model.embeddings.create(
                model=OPENAI_EMBED_MODEL, input=texts
            )
            return [list(item.embedding) for item in response.data]

        # fastembed returns an iterable of numpy arrays.
        return [vector.tolist() for vector in self._model.embed(texts)]


# ---------------------------------------------------------------------------
# Vector store
# ---------------------------------------------------------------------------
class WeaviateStore:
    """Thin wrapper over the Weaviate v4 client for the HealthFact collection."""

    def __init__(self, url: str = WEAVIATE_URL):
        self.url = url
        self._client: Any = None

    def _connect(self) -> Any:
        """Lazily connect using weaviate-client v4 (parsed from the URL)."""
        if self._client is not None:
            return self._client

        import weaviate
        from urllib.parse import urlparse

        parsed = urlparse(self.url)
        host = parsed.hostname or "weaviate"
        secure = parsed.scheme == "https"
        http_port = parsed.port or (443 if secure else 8080)
        # gRPC default for the official image; not host-published in compose but
        # required by the v4 client. 50051 is the standard Weaviate gRPC port.
        grpc_port = 50051

        self._client = weaviate.connect_to_custom(
            http_host=host,
            http_port=http_port,
            http_secure=secure,
            grpc_host=host,
            grpc_port=grpc_port,
            grpc_secure=secure,
            skip_init_checks=True,
        )
        return self._client

    def close(self) -> None:
        if self._client is not None:
            try:
                self._client.close()
            except Exception:  # pragma: no cover - best-effort cleanup
                pass
            self._client = None

    def _ensure_collection(self, client: Any, dimension: int) -> Any:
        """Create the HealthFact collection if absent. Returns the collection.

        The collection name encodes nothing about dimension; the per-fact
        `embed_dim` property lets `index()` detect a provider/dimension change
        and rebuild.
        """
        from weaviate.classes.config import Configure, DataType, Property

        if client.collections.exists(COLLECTION_NAME):
            return client.collections.get(COLLECTION_NAME)

        logger.info("Creating Weaviate collection %s (dim=%d)", COLLECTION_NAME, dimension)
        return client.collections.create(
            name=COLLECTION_NAME,
            vectorizer_config=Configure.Vectorizer.none(),
            properties=[
                Property(name="fact_id", data_type=DataType.TEXT),
                Property(name="text", data_type=DataType.TEXT),
                Property(name="foods", data_type=DataType.TEXT_ARRAY),
                Property(name="nutrients", data_type=DataType.TEXT_ARRAY),
                Property(name="food_groups", data_type=DataType.TEXT_ARRAY),
                Property(name="tags", data_type=DataType.TEXT_ARRAY),
                Property(name="embed_dim", data_type=DataType.INT),
            ],
        )

    def index(self, facts: list[dict], vectors: list[list[float]]) -> int:
        """Idempotently populate the collection.

        - If already populated with a matching embedding dimension -> skip.
        - On a dimension mismatch -> drop the collection and rebuild.
        Returns the number of objects written (0 when skipped).
        """
        if not facts:
            return 0
        dimension = len(vectors[0]) if vectors else 0

        client = self._connect()
        collection = self._ensure_collection(client, dimension)

        existing = collection.aggregate.over_all(total_count=True).total_count or 0
        if existing > 0:
            if self._stored_dimension(collection) == dimension and existing >= len(facts):
                logger.info(
                    "HealthFact already indexed (%d objects, dim=%d); skipping",
                    existing,
                    dimension,
                )
                return 0
            logger.warning(
                "HealthFact dimension/count mismatch (stored=%s, new=%d); rebuilding",
                self._stored_dimension(collection),
                dimension,
            )
            client.collections.delete(COLLECTION_NAME)
            collection = self._ensure_collection(client, dimension)

        written = 0
        with collection.batch.dynamic() as batch:
            for fact, vector in zip(facts, vectors):
                batch.add_object(
                    properties={
                        "fact_id": fact.get("id", ""),
                        "text": fact.get("text", ""),
                        "foods": fact.get("foods", []),
                        "nutrients": fact.get("nutrients", []),
                        "food_groups": fact.get("food_groups", []),
                        "tags": fact.get("tags", []),
                        "embed_dim": dimension,
                    },
                    vector=vector,
                )
                written += 1
        logger.info("Indexed %d HealthFact objects (dim=%d)", written, dimension)
        return written

    @staticmethod
    def _stored_dimension(collection: Any) -> Optional[int]:
        """Read the embed_dim recorded on any one stored object, or None."""
        try:
            result = collection.query.fetch_objects(limit=1)
            if result.objects:
                return result.objects[0].properties.get("embed_dim")
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("Could not read stored dimension: %s", exc)
        return None

    def is_ready(self) -> bool:
        """True only when Weaviate is reachable (used to gate the startup build)."""
        try:
            return bool(self._connect().is_ready())
        except Exception as exc:
            logger.warning("Weaviate not reachable at %s: %s", self.url, exc)
            return False

    def is_populated(self) -> bool:
        """True when the collection exists and holds at least one object."""
        try:
            client = self._connect()
            if not client.collections.exists(COLLECTION_NAME):
                return False
            collection = client.collections.get(COLLECTION_NAME)
            return (collection.aggregate.over_all(total_count=True).total_count or 0) > 0
        except Exception as exc:
            logger.warning("Weaviate availability check failed: %s", exc)
            return False

    def search(self, vector: list[float], top_k: int) -> list[dict]:
        """Vector search; returns a list of fact dicts (id/text/metadata)."""
        client = self._connect()
        collection = client.collections.get(COLLECTION_NAME)
        result = collection.query.near_vector(near_vector=vector, limit=top_k)
        facts: list[dict] = []
        for obj in result.objects:
            props = obj.properties or {}
            facts.append(
                {
                    "id": props.get("fact_id", ""),
                    "text": props.get("text", ""),
                    "foods": props.get("foods", []),
                    "nutrients": props.get("nutrients", []),
                    "food_groups": props.get("food_groups", []),
                    "tags": props.get("tags", []),
                }
            )
        return facts


# ---------------------------------------------------------------------------
# Corpus loading
# ---------------------------------------------------------------------------
def load_health_facts(path: str = HEALTH_FACTS_PATH) -> list[dict]:
    """Load the curated health-facts corpus from JSON."""
    facts = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(facts, list):
        raise ValueError(f"health_facts.json must be a JSON array, got {type(facts)}")
    return facts


# ---------------------------------------------------------------------------
# Insight engine
# ---------------------------------------------------------------------------
class HealthInsightEngine:
    """Retrieve-augment-generate over the HealthFact corpus."""

    def __init__(
        self,
        embedder: Optional[EmbeddingProvider] = None,
        store: Optional[WeaviateStore] = None,
        text_llm: Any = None,
        top_k: int = INSIGHT_TOPK,
    ):
        self.embedder = embedder or EmbeddingProvider()
        self.store = store or WeaviateStore()
        self.text_llm = text_llm if text_llm is not None else self._build_text_llm()
        self.top_k = top_k

    @staticmethod
    def _build_text_llm() -> Any:
        """Build the text LLM the same way nutrition_analyzer does (TEXT_OPENAI_*).
        Returns None when unconfigured so the engine can fail soft."""
        if not TEXT_OPENAI_BASE_URL or not TEXT_OPENAI_API_KEY:
            return None
        try:
            return ChatOpenAI(
                model=TEXT_OPENAI_MODEL,
                api_key=TEXT_OPENAI_API_KEY,
                base_url=TEXT_OPENAI_BASE_URL,
                temperature=0.3,
                max_tokens=200,
            )
        except Exception as exc:  # pragma: no cover - construction guard
            logger.warning("Insight text LLM init failed: %s", exc)
            return None

    @property
    def generated_by(self) -> str:
        if self.text_llm is not None:
            return f"text-llm:{TEXT_OPENAI_MODEL}"
        return "none"

    # -- query construction ------------------------------------------------
    def build_query(self, profile: dict) -> str:
        """Natural-language summary of the eating profile (no RDA thresholds).

        Combines the dominant foods (by grams) with a plain macro-summary
        sentence so the embedding captures both what was eaten and its
        macro shape.
        """
        foods = profile.get("foods") or []
        ranked = sorted(
            (f for f in foods if isinstance(f, dict)),
            key=lambda f: _coerce_float(f.get("total_grams", 0)),
            reverse=True,
        )
        names = [str(f.get("name", "")).strip() for f in ranked if f.get("name")]
        top_names = [n for n in names if n][:6]

        if top_names:
            foods_sentence = "The diet is dominated by " + ", ".join(top_names) + "."
        else:
            foods_sentence = "Few foods have been logged."

        macros = profile.get("nutrient_totals") or {}
        macro_sentence = self._macro_summary(macros)

        days = int(_coerce_float(profile.get("days_logged", 0)))
        window = str(profile.get("window", "week"))
        context = f"Logged over {days} day(s) this {window}."

        return f"{foods_sentence} {macro_sentence} {context}".strip()

    @staticmethod
    def _macro_summary(macros: dict) -> str:
        """Describe the macro mix qualitatively, no fixed thresholds."""
        if not macros:
            return "Macro totals were not provided."

        def g(key: str) -> float:
            return _coerce_float(macros.get(key, 0))

        protein, carbs, fat, fiber = g("protein"), g("carbs"), g("fat"), g("fiber")
        total = protein + carbs + fat
        if total <= 0:
            return "Macro totals were not provided."

        # Express as relative share so the LLM can reason about balance without
        # any hardcoded RDA numbers.
        shares = {
            "protein": round(100 * protein / total),
            "carbs": round(100 * carbs / total),
            "fat": round(100 * fat / total),
        }
        dominant = max(shares, key=shares.get)
        return (
            f"By weight the macros are roughly {shares['protein']}% protein, "
            f"{shares['carbs']}% carbohydrate, and {shares['fat']}% fat "
            f"(mostly {dominant}), with about {round(fiber)}g of fiber."
        )

    # -- prompt + generation ----------------------------------------------
    @staticmethod
    def _build_prompt(query: str, facts: list[dict]) -> str:
        fact_lines = "\n".join(f"- {f.get('text', '')}" for f in facts)
        return (
            "You are a friendly nutrition coach. Using ONLY the eating summary and "
            "the reference facts below, write 2-3 short sentences of personalized, "
            "encouraging feedback. Note one clear strength and one realistic way to "
            "improve. Do not give medical advice, diagnose, or invent numbers.\n\n"
            f"Eating summary: {query}\n\n"
            f"Reference facts:\n{fact_lines}\n\n"
            "Insight:"
        )

    def _generate(self, query: str, facts: list[dict]) -> Optional[str]:
        if self.text_llm is None:
            return None
        try:
            prompt = self._build_prompt(query, facts)
            response = self.text_llm.invoke([HumanMessage(content=prompt)])
            text = (getattr(response, "content", "") or "").strip()
            return text or None
        except Exception as exc:
            logger.warning("Insight generation failed: %s", exc)
            return None

    def _generic_tip(self, query: str) -> Optional[str]:
        """Profile-only generation used when retrieval is impossible."""
        if self.text_llm is None:
            return None
        try:
            prompt = (
                "You are a friendly nutrition coach. Based only on this eating "
                "summary, write 2-3 short, encouraging sentences with one general "
                "tip to improve diet quality. No medical advice, no invented "
                f"numbers.\n\nEating summary: {query}\n\nTip:"
            )
            response = self.text_llm.invoke([HumanMessage(content=prompt)])
            text = (getattr(response, "content", "") or "").strip()
            return text or None
        except Exception as exc:
            logger.warning("Generic tip generation failed: %s", exc)
            return None

    # -- main entrypoint ---------------------------------------------------
    def insight(self, profile: dict) -> dict:
        """Retrieve -> augment -> generate. Always returns a dict, never raises."""
        query = self.build_query(profile)

        # 1) Retrieve.
        facts: list[dict] = []
        try:
            vectors = self.embedder.embed([query])
            if vectors:
                facts = self.store.search(vectors[0], self.top_k)
        except Exception as exc:
            logger.warning("Retrieval failed (Weaviate/embedding): %s", exc)
            facts = []

        # 2) Weaviate down/empty -> generic, profile-only tip (degraded).
        if not facts:
            tip = self._generic_tip(query)
            return {
                "insight": tip or self._fallback_text(query),
                "facts_used": [],
                "generated_by": self.generated_by,
                "result": "degraded",
            }

        # 3) Retrieval worked -> try to generate.
        generated = self._generate(query, facts)
        facts_used = [{"id": f.get("id", ""), "text": f.get("text", "")} for f in facts]

        if generated is None:
            # LLM down but retrieval worked -> return top fact verbatim (degraded).
            top = facts[0]
            return {
                "insight": top.get("text", ""),
                "facts_used": facts_used[:1],
                "generated_by": "retrieval-only",
                "result": "degraded",
            }

        return {
            "insight": generated,
            "facts_used": facts_used,
            "generated_by": self.generated_by,
            "result": "success",
        }

    @staticmethod
    def _fallback_text(query: str) -> str:
        """Last-resort static tip when no LLM and no retrieval are available."""
        return (
            "Keep logging your meals to spot patterns. Aiming for a mix of "
            "vegetables, whole grains, lean protein, and legumes is a reliable "
            "way to improve overall diet quality."
        )


# ---------------------------------------------------------------------------
# Index build helper
# ---------------------------------------------------------------------------
def build_index(
    embedder: Optional[EmbeddingProvider] = None,
    store: Optional[WeaviateStore] = None,
    facts_path: str = HEALTH_FACTS_PATH,
) -> int:
    """Load the corpus, embed it, and upsert it into Weaviate. Idempotent.
    Returns the number of objects written (0 when already up to date)."""
    embedder = embedder or EmbeddingProvider()
    store = store or WeaviateStore()
    facts = load_health_facts(facts_path)
    vectors = embedder.embed([f.get("text", "") for f in facts])
    return store.index(facts, vectors)


def _coerce_float(value: Any) -> float:
    try:
        if value is None:
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0
