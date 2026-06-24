"""Nutrition analyzer for food images and nutrition estimation."""

from __future__ import annotations

import base64
import json
import logging
import re
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, Optional

import requests
from PIL import Image
from pydantic import BaseModel

from langchain_core.messages import HumanMessage
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

from importlib import import_module

# Google / Gemini support is commented out for now to keep the runtime focused on
# local Ollama + USDA only. If you want to re-enable Google, uncomment the
# dynamic import below and ensure langchain-google-genai is installed.
try:
     ChatGoogleGenerativeAI = import_module("langchain_google_genai").ChatGoogleGenerativeAI
except Exception:  # Optional dependency.
     ChatGoogleGenerativeAI = None

from config import (
    GOOGLE_API_KEY,
    GOOGLE_MODEL,
    LLM_PROVIDER,
    NUTRITION_DATA_PROVIDER,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    OPENAI_MODEL,
    TEXT_OPENAI_API_KEY,
    TEXT_OPENAI_BASE_URL,
    TEXT_OPENAI_MODEL,
    USDA_FDC_API_KEY,
)

logger = logging.getLogger(__name__)

# Alias map: map common colloquial names to canonical lookup terms.
ALIASES: dict[str, str] = {
    "burger": "hamburger",
    "pizza": "pizza",
    "salad": "salad",
    "oatmeal bowl": "oatmeal",
    "pizza slice": "pizza",
}

# Typical single-serving sizes for common foods (grams, label).
_TYPICAL_PORTIONS: dict[str, tuple[float, str]] = {
    "toast":          (30,  "1 slice"),
    "bread":          (25,  "1 slice"),
    "white bread":    (25,  "1 slice"),
    "whole wheat bread": (28, "1 slice"),
    "bagel":          (98,  "1 medium"),
    "egg":            (50,  "1 large"),
    "banana":         (118, "1 medium"),
    "apple":          (182, "1 medium"),
    "orange":         (131, "1 medium"),
    "oats":           (40,  "½ cup dry"),
    "oatmeal":        (234, "1 cup cooked"),
    "chicken breast": (174, "1 breast"),
    "rice":           (186, "1 cup cooked"),
    "brown rice":     (195, "1 cup cooked"),
    "pasta":          (140, "1 cup cooked"),
    "potato":         (148, "1 medium"),
    "sweet potato":   (130, "1 medium"),
    "milk":           (244, "1 cup"),
    "whole milk":     (244, "1 cup"),
    "yogurt":         (170, "¾ cup"),
    "greek yogurt":   (170, "¾ cup"),
    "cheese":         (28,  "1 oz"),
    "butter":         (14,  "1 tbsp"),
    "olive oil":      (14,  "1 tbsp"),
    "peanut butter":  (32,  "2 tbsp"),
    "almond butter":  (32,  "2 tbsp"),
    "almonds":        (28,  "1 oz (~23 nuts)"),
    "walnuts":        (28,  "1 oz"),
    "avocado":        (150, "1 medium"),
    "salmon":         (170, "1 fillet"),
    "tuna":           (85,  "3 oz"),
    "hamburger":      (200, "1 burger"),
    "pizza":          (107, "1 slice"),
    "salad":          (150, "1 bowl"),
    "broccoli":       (91,  "1 cup"),
    "spinach":        (30,  "1 cup"),
    "carrot":         (61,  "1 medium"),
    "tomato":         (123, "1 medium"),
    "lentils":        (198, "1 cup cooked"),
    "beans":          (172, "1 cup cooked"),
    "orange juice":   (240, "1 cup"),
    "coffee":         (240, "1 cup"),
    "chocolate":      (40,  "1 bar (small)"),
    "cookie":         (28,  "1 cookie"),
    "muffin":         (113, "1 muffin"),
}


def _typical_portion(food_name: str) -> tuple[float, str]:
    """Return (grams, label) for a typical single serving of the given food."""
    key = food_name.strip().lower()
    if key in _TYPICAL_PORTIONS:
        return _TYPICAL_PORTIONS[key]
    # Partial match: check if any known key is contained in the food name
    for known, portion in _TYPICAL_PORTIONS.items():
        if known in key or key in known:
            return portion
    return (100.0, "100 g")


class NutritionResponse(BaseModel):
    """Response from the nutrition analyzer."""

    foods: list[str]
    calories: float
    protein_grams: float
    carbs_grams: float
    fat_grams: float
    fiber_grams: float
    confidence: float


class NutritionAnalysisResult(BaseModel):
    """Single-provider analysis result used for comparisons."""

    provider: str
    foods: list[str]
    calories: float
    protein_grams: float
    carbs_grams: float
    fat_grams: float
    fiber_grams: float
    confidence: float


class NutritionComparisonResponse(BaseModel):
    """Comparison of two provider estimates for the same image."""

    primary: NutritionAnalysisResult
    secondary: NutritionAnalysisResult
    calorie_difference: float
    calorie_difference_percent: float


def _normalize_food_name(food_name: str) -> str:
    return re.sub(r"\s+", " ", food_name.lower().strip())


def _coerce_float(value: Any) -> float:
    try:
        if value is None:
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


class NutritionDataClient:
    """Resolve nutrition data from live APIs with a local fallback cache."""

    USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"
    USDA_FOOD_URL = "https://api.nal.usda.gov/fdc/v1/food/{fdc_id}"

    def __init__(self, local_fallback: Dict[str, Dict[str, Any]], provider: str = NUTRITION_DATA_PROVIDER, usda_api_key: Optional[str] = None):
        """local_fallback: dict of local nutrition entries
        provider: which provider to prefer ('usda'|'local')
        usda_api_key: optional explicit USDA FDC API key to use (overrides env/config)
        """
        self.local_fallback = local_fallback or {}
        self.provider = provider
        self.session = requests.Session()
        # Set a sensible User-Agent and Accept header to avoid being blocked by public endpoints
        self.session.headers.update({
            "User-Agent": "team-password123-nutrition-analyzer/1.0",
            "Accept": "application/json",
        })
        self.cache: Dict[str, Dict[str, Any]] = {}
        # Allow overriding the USDA key at runtime (helps LlamaIndex tool wiring)
        self.usda_api_key = usda_api_key or USDA_FDC_API_KEY
        # Path to the local nutrition DB file (used for persisting lookups)
        self._db_path = Path(__file__).parent / "nutrition_db.json"
        # Whether to persist successful remote lookups into the local DB
        self.allow_persist = True

    def lookup(self, food_name: str) -> Optional[Dict[str, Any]]:
        normalized_name = _normalize_food_name(food_name)
        if not normalized_name:
            return None

        if normalized_name in self.cache:
            return self.cache[normalized_name]

        for source in self._source_order():
            resolver = getattr(self, f"_lookup_{source}", None)
            if not resolver:
                continue

            try:
                result = resolver(food_name, normalized_name)
            except Exception as exc:
                logger.warning("Nutrition lookup via %s failed for '%s': %s", source, food_name, exc)
                result = None

            if result:
                self.cache[normalized_name] = result
                return result

        logger.warning("Nutrition data not found for: %s", food_name)
        return None

    def _source_order(self) -> list[str]:
        # Prefer USDA and only fall back to the local cache.
        if self.provider == "usda":
            return ["usda", "local"]
        if self.provider == "local":
            return ["local"]
        return ["usda", "local"]

    def _lookup_local(self, food_name: str, normalized_name: str) -> Optional[Dict[str, Any]]:
        # Exact match
        entry = self.local_fallback.get(normalized_name)
        if entry:
            # If the local entry has an implausible calorie value (e.g., branded
            # product or cookie) try to find a better alternative (singular form
            # or nearby key) before returning.
            cal = _coerce_float(entry.get("calories_per_100g"))
            if cal and cal > 400:
                # try singular form
                if normalized_name.endswith("s"):
                    alt = normalized_name[:-1]
                    alt_entry = self.local_fallback.get(alt)
                    if alt_entry and _coerce_float(alt_entry.get("calories_per_100g")) < 400:
                        return {**alt_entry, "source": "local"}

                # scan for nearby reasonable matches
                for db_key, db_val in self.local_fallback.items():
                    if normalized_name in db_key or db_key in normalized_name:
                        if _coerce_float(db_val.get("calories_per_100g")) and _coerce_float(db_val.get("calories_per_100g")) < 400:
                            logger.debug("Local fallback alternative '%s' -> '%s'", food_name, db_key)
                            return {**db_val, "source": "local"}

            return {**entry, "source": "local"}

        for db_key, db_val in self.local_fallback.items():
            if normalized_name in db_key or db_key in normalized_name:
                logger.debug("Local fallback matched '%s' -> '%s'", food_name, db_key)
                return {**db_val, "source": "local"}

        return None

    def _lookup_usda(self, food_name: str, normalized_name: str) -> Optional[Dict[str, Any]]:
        # Prefer an explicit key if provided when the client was constructed
        key_to_use = getattr(self, 'usda_api_key', None) or USDA_FDC_API_KEY
        if not key_to_use:
            return None
        try:
            response = self.session.get(
                self.USDA_SEARCH_URL,
                params={"api_key": key_to_use, "query": food_name, "pageSize": 5},
                timeout=12,
            )
            response.raise_for_status()
        except requests.exceptions.RequestException as exc:
            # Handle transient network / HTTP errors (including 503) gracefully.
            logger.warning("USDA lookup failed for '%s' (will skip): %s", food_name, exc)
            return None

        foods = response.json().get("foods", [])
        selected_food = self._select_best_usda_food(foods, normalized_name)
        if not selected_food:
            return None

        fdc_id = selected_food.get("fdcId")
        food_payload = selected_food
        if fdc_id:
            try:
                detail_response = self.session.get(
                    self.USDA_FOOD_URL.format(fdc_id=fdc_id),
                    params={"api_key": key_to_use},
                    timeout=12,
                )
                detail_response.raise_for_status()
                food_payload = detail_response.json()
            except requests.exceptions.RequestException:
                # If the detail endpoint fails, continue with the search payload.
                logger.debug("USDA detail lookup failed for fdc_id=%s, using search result", fdc_id)

        nutrition = self._extract_usda_nutrition(food_payload)
        if nutrition:
            nutrition["name"] = selected_food.get("description") or food_name
            nutrition["source"] = "usda"
            # Persist into the local fallback DB so future lookups are faster
            try:
                if self.allow_persist:
                    self._persist_local(normalized_name, nutrition)
            except Exception:
                logger.debug("Failed to persist USDA nutrition for %s", normalized_name)
        return nutrition

    def _select_best_usda_food(self, foods: list[dict[str, Any]], normalized_name: str) -> Optional[dict[str, Any]]:
        if not foods:
            return None
        # Prefer candidates that already include nutrient information (e.g., calories)
        def has_calorie_info(food: dict[str, Any]) -> bool:
            fn = food.get("foodNutrients") or []
            for n in fn:
                nutrient_name = str(n.get("nutrientName") or n.get("name") or "").lower()
                nutrient_number = str(n.get("nutrientNumber") or n.get("number") or "")
                if "energy" in nutrient_name or nutrient_number == "1008":
                    return True
            return False

        nutrient_candidates = [f for f in foods if has_calorie_info(f)]
        candidates = nutrient_candidates if nutrient_candidates else foods

        def score(food: dict[str, Any]) -> tuple[int, int]:
            description = _normalize_food_name(str(food.get("description", "")))
            additional = _normalize_food_name(str(food.get("additionalDescriptions", "")))
            brand = _normalize_food_name(str(food.get("brandName", "")))
            match_score = 0

            if description == normalized_name:
                match_score += 100
            if normalized_name in description:
                match_score += 60
            if description in normalized_name:
                match_score += 30
            if normalized_name in additional:
                match_score += 15
            if normalized_name in brand:
                match_score += 10

            # Prefer longer descriptions slightly to avoid empty labels
            return match_score, len(description)

        return max(candidates, key=score)

    def _extract_usda_nutrition(self, food_payload: dict[str, Any]) -> Optional[Dict[str, Any]]:
        food_nutrients = food_payload.get("foodNutrients") or []
        if not food_nutrients:
            return None

        data_type = str(food_payload.get("dataType", "")).lower()
        serving_size = _coerce_float(food_payload.get("servingSize"))
        scale_to_100g = data_type == "branded" and serving_size > 0

        calories = protein = carbs = fat = fiber = None
        for nutrient in food_nutrients:
            nutrient_name = str(nutrient.get("nutrientName") or nutrient.get("name") or "").lower()
            nutrient_number = str(nutrient.get("nutrientNumber") or nutrient.get("number") or "")
            value = _coerce_float(nutrient.get("value"))
            if value == 0.0:
                continue

            if scale_to_100g:
                value = value * 100.0 / serving_size

            unit_name = str(nutrient.get("unitName") or nutrient.get("unit") or "").lower()

            if nutrient_number == "1008" or "energy" in nutrient_name:
                calories = value if "kj" not in unit_name else value * 0.239005736
            elif nutrient_number == "1003" or "protein" in nutrient_name:
                protein = value
            elif nutrient_number == "1005" or "carbohydrate" in nutrient_name:
                carbs = value
            elif nutrient_number == "1004" or "lipid" in nutrient_name or "fat" in nutrient_name:
                fat = value
            elif nutrient_number == "1079" or "fiber" in nutrient_name:
                fiber = value

        if calories is None and protein is None and carbs is None and fat is None and fiber is None:
            return None

        return {
            "calories_per_100g": calories or 0.0,
            "protein_per_100g": protein or 0.0,
            "carbs_per_100g": carbs or 0.0,
            "fat_per_100g": fat or 0.0,
            "fiber_per_100g": fiber or 0.0,
        }

    def _persist_local(self, normalized_name: str, nutrition: dict[str, Any]) -> None:
        """Persist a nutrition entry into the on-disk local DB and update in-memory cache.

        This writes a compact representation to services/genai-service/nutrition_db.json.
        """
        try:
            # Load existing file if present
            db: Dict[str, Any] = {}
            if self._db_path.exists():
                try:
                    db = json.loads(self._db_path.read_text(encoding="utf-8"))
                except Exception:
                    db = {}

            # Only persist the core per-100g fields and the name/source
            entry = {
                "calories_per_100g": _coerce_float(nutrition.get("calories_per_100g")),
                "protein_per_100g": _coerce_float(nutrition.get("protein_per_100g")),
                "carbs_per_100g": _coerce_float(nutrition.get("carbs_per_100g")),
                "fat_per_100g": _coerce_float(nutrition.get("fat_per_100g")),
                "fiber_per_100g": _coerce_float(nutrition.get("fiber_per_100g")),
                "name": nutrition.get("name"),
                "source": nutrition.get("source"),
            }

            db[normalized_name] = entry
            # Write atomically
            tmp = self._db_path.with_suffix(".tmp")
            tmp.write_text(json.dumps(db, indent=2, ensure_ascii=False), encoding="utf-8")
            tmp.replace(self._db_path)

            # Update in-memory fallback so subsequent lookups use it
            self.local_fallback[normalized_name] = entry
        except Exception as exc:
            logger.debug("Persist failed for %s: %s", normalized_name, exc)


class NutritionAnalyzer:
    """Analyzes food images and returns nutritional estimates using a vision LLM."""

    def __init__(self):
        self.provider = LLM_PROVIDER
        self.llm = None
        self.fallback_llm = None
        self.nutrition_db = self._load_nutrition_db()
        self.nutrition_data = NutritionDataClient(self.nutrition_db)

        self.llm = self._build_llm(self.provider)
        self.fallback_llm = self._build_fallback_llm(self.provider)
        self.text_llm = self._build_text_llm()

        if not self.llm and not self.fallback_llm:
            raise RuntimeError(
                "No LLM provider available. Set LLM_PROVIDER to ollama, openai, or google and configure the matching API key or local model."
            )

    def _build_llm(self, provider: str):
        if provider == "ollama":
            try:
                logger.info("Initializing Ollama at %s with model %s", OLLAMA_BASE_URL, OLLAMA_MODEL)
                return ChatOllama(
                    base_url=OLLAMA_BASE_URL,
                    model=OLLAMA_MODEL,
                    temperature=0,
                )
            except Exception as exc:
                logger.warning("Ollama initialization failed: %s", exc)
                return None

        if provider == "openai":
            if not OPENAI_API_KEY:
                logger.warning("OPENAI_API_KEY is not set.")
                return None
            try:
                logger.info("Initializing OpenAI with model %s", OPENAI_MODEL)
                return ChatOpenAI(
                    model=OPENAI_MODEL,
                    api_key=OPENAI_API_KEY,
                    base_url=OPENAI_BASE_URL or None,
                    temperature=0,
                    max_tokens=1024,
                )
            except Exception as exc:
                logger.warning("OpenAI initialization failed: %s", exc)
                return None

        # Google/Gemini support temporarily disabled to avoid external quota and
        # runtime dependency on langchain-google-genai. Re-enable if needed.
        # if provider == "google":
        #     if not GOOGLE_API_KEY:
        #         logger.warning("GOOGLE_API_KEY is not set.")
        #         return None
        #     if ChatGoogleGenerativeAI is None:
        #         logger.warning("langchain-google-genai is not installed.")
        #         return None
        #     try:
        #         logger.info("Initializing Google Gemini with model %s", GOOGLE_MODEL)
        #         return ChatGoogleGenerativeAI(
        #             model=GOOGLE_MODEL,
        #             google_api_key=GOOGLE_API_KEY,
        #             temperature=0,
        #             max_output_tokens=1024,
        #         )
        #     except Exception as exc:
        #         logger.warning("Google Gemini initialization failed: %s", exc)
        #         return None

        logger.warning("Unknown LLM provider: %s", provider)
        return None

    def _build_text_llm(self):
        """Build a dedicated text-only LLM for food-name estimation (e.g. Logos).
        Returns None when TEXT_OPENAI_BASE_URL / TEXT_OPENAI_API_KEY are not set,
        in which case callers fall back to the primary LLM."""
        if not TEXT_OPENAI_BASE_URL or not TEXT_OPENAI_API_KEY:
            return None
        try:
            logger.info("Initializing text LLM at %s with model %s", TEXT_OPENAI_BASE_URL, TEXT_OPENAI_MODEL)
            return ChatOpenAI(
                model=TEXT_OPENAI_MODEL,
                api_key=TEXT_OPENAI_API_KEY,
                base_url=TEXT_OPENAI_BASE_URL,
                temperature=0,
                max_tokens=256,
            )
        except Exception as exc:
            logger.warning("Text LLM initialization failed: %s", exc)
            return None

    def _build_fallback_llm(self, provider: str):
        fallback_order = []
        if provider != "ollama":
            fallback_order.append("ollama")
        if provider != "openai":
            fallback_order.append("openai")
        # Google fallback removed while focusing on Ollama + USDA
        # if provider != "google":
        #     fallback_order.append("google")

        for fallback_provider in fallback_order:
            llm = self._build_llm(fallback_provider)
            if llm:
                logger.info("Configured %s as fallback LLM", fallback_provider)
                return llm

        return None

    @staticmethod
    def _load_nutrition_db() -> Dict[str, Dict[str, Any]]:
        """Load the local nutrition cache from JSON."""
        try:
            db_path = Path(__file__).parent / "nutrition_db.json"
            with db_path.open("r", encoding="utf-8") as file_handle:
                return json.load(file_handle)
        except Exception as exc:
            logger.warning("Failed to load nutrition cache: %s", exc)
            return {}

    def _lookup_food_nutrition(self, food_name: str) -> Optional[Dict[str, Any]]:
        """Look up nutritional data for a food item."""
        return self.nutrition_data.lookup(food_name)

    def _calculate_macros_from_foods(self, foods_with_grams: list) -> tuple[float, float, float, float, float]:
        """Calculate total macros from identified foods with portion sizes."""
        total_calories = 0.0
        total_protein = 0.0
        total_carbs = 0.0
        total_fat = 0.0
        total_fiber = 0.0

        for item in foods_with_grams:
            if not isinstance(item, dict):
                continue

            food_name = str(item.get("food", "")).strip()
            grams = _coerce_float(item.get("grams", 0))

            if not food_name or grams <= 0:
                continue

            # Apply alias normalization
            normalized = _normalize_food_name(food_name)
            canonical = ALIASES.get(normalized, normalized)

            # First try direct nutrition lookup for the canonical name
            nutrition = self._lookup_food_nutrition(canonical)

            if nutrition:
                multiplier = grams / 100.0
                total_calories += _coerce_float(nutrition.get("calories_per_100g")) * multiplier
                total_protein += _coerce_float(nutrition.get("protein_per_100g")) * multiplier
                total_carbs += _coerce_float(nutrition.get("carbs_per_100g")) * multiplier
                total_fat += _coerce_float(nutrition.get("fat_per_100g")) * multiplier
                total_fiber += _coerce_float(nutrition.get("fiber_per_100g")) * multiplier
                continue

            # If no direct match, try dynamic decomposition:
            parts = self._decompose_food_name(normalized)
            if parts:
                logger.info("Dynamically decomposed '%s' into parts: %s", food_name, parts)
                # Distribute grams among parts proportionally (equal share)
                share = grams / max(len(parts), 1)
                for part_name in parts:
                    part_nutrition = self._lookup_food_nutrition(part_name)
                    if not part_nutrition:
                        logger.info("No nutrition for decomposed part '%s' (skipping)", part_name)
                        continue
                    pmult = share / 100.0
                    total_calories += _coerce_float(part_nutrition.get("calories_per_100g")) * pmult
                    total_protein += _coerce_float(part_nutrition.get("protein_per_100g")) * pmult
                    total_carbs += _coerce_float(part_nutrition.get("carbs_per_100g")) * pmult
                    total_fat += _coerce_float(part_nutrition.get("fat_per_100g")) * pmult
                    total_fiber += _coerce_float(part_nutrition.get("fiber_per_100g")) * pmult
                continue

            # No nutrition available for this food and no dynamic decomposition succeeded; skip
            logger.info("No nutrition data for '%s' (skipping)", food_name)
            continue

        return total_calories, total_protein, total_carbs, total_fat, total_fiber

    def estimate_from_name(self, food_name: str) -> dict:
        """Estimate nutrition per 100g for a food by name, plus a typical serving size.
        Returns per-100g values so the caller can scale to any portion.
        Tries USDA first, then falls back to text LLM."""
        normalized = _normalize_food_name(food_name)
        canonical = ALIASES.get(normalized, normalized)

        nutrition = self._lookup_food_nutrition(canonical)
        if nutrition:
            portion_grams, portion_label = _typical_portion(canonical)
            return {
                "food_name": food_name,
                "calories_per_100g":      round(_coerce_float(nutrition.get("calories_per_100g")), 1),
                "protein_grams_per_100g": round(_coerce_float(nutrition.get("protein_per_100g")), 1),
                "carbs_grams_per_100g":   round(_coerce_float(nutrition.get("carbs_per_100g")), 1),
                "fat_grams_per_100g":     round(_coerce_float(nutrition.get("fat_per_100g")), 1),
                "typical_portion_grams":  portion_grams,
                "typical_portion_label":  portion_label,
                "source": nutrition.get("source", "usda"),
                "confidence": 0.9,
            }

        llm_to_use = self.text_llm or self.llm or self.fallback_llm
        if not llm_to_use:
            raise ValueError("No LLM available for text estimation")

        prompt = (
            f'Estimate the nutritional content per 100g of "{food_name}", '
            "and suggest a typical single serving size.\n"
            "Reply ONLY with a single JSON object, no markdown, no explanation:\n"
            '{"calories_per_100g": 155, "protein_grams_per_100g": 6, "carbs_grams_per_100g": 17, '
            '"fat_grams_per_100g": 7, "typical_portion_grams": 30, "typical_portion_label": "1 slice", '
            '"confidence": 0.85}'
        )
        from langchain_core.messages import HumanMessage as _HM
        response = llm_to_use.invoke([_HM(content=prompt)])
        raw = response.content.strip()
        raw = re.sub(r"```(?:json)?\s*(.*?)\s*```", r"\1", raw, flags=re.DOTALL)
        payload = self._try_parse_json(raw)
        if not isinstance(payload, dict):
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            payload = self._try_parse_json(m.group(0)) if m else None
        if not isinstance(payload, dict):
            raise ValueError(f"Could not parse LLM response: {raw[:200]}")

        portion_grams = _coerce_float(payload.get("typical_portion_grams", 100))
        portion_label = str(payload.get("typical_portion_label") or f"{int(portion_grams)} g")

        return {
            "food_name": food_name,
            "calories_per_100g":      round(_coerce_float(payload.get("calories_per_100g")), 1),
            "protein_grams_per_100g": round(_coerce_float(payload.get("protein_grams_per_100g")), 1),
            "carbs_grams_per_100g":   round(_coerce_float(payload.get("carbs_grams_per_100g")), 1),
            "fat_grams_per_100g":     round(_coerce_float(payload.get("fat_grams_per_100g")), 1),
            "typical_portion_grams":  round(max(1.0, portion_grams), 1),
            "typical_portion_label":  portion_label,
            "source": "llm",
            "confidence": max(0.0, min(1.0, _coerce_float(payload.get("confidence", 0.6)))),
        }

    def analyze(self, image_base64: str) -> NutritionResponse:
        """Analyze a base64-encoded food image and return nutrition estimates."""
        try:
            image_data = base64.b64decode(image_base64)
            img = Image.open(BytesIO(image_data))
            img_format = img.format or "JPEG"

            message = HumanMessage(
                content=[
                    {"type": "text", "text": self._build_prompt()},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/{img_format.lower()};base64,{image_base64}"},
                    },
                ]
            )

            response = None
            if self.llm:
                try:
                    logger.info("Calling %s for image analysis", self.provider)
                    response = self.llm.invoke([message])
                except Exception as exc:
                    logger.warning("Primary LLM failed: %s", exc)

            if not response and self.fallback_llm:
                try:
                    logger.info("Calling fallback LLM")
                    response = self.fallback_llm.invoke([message])
                except Exception as exc:
                    logger.error("Fallback LLM also failed: %s", exc)
                    raise ValueError(f"All LLM providers failed: {exc}") from exc

            if not response:
                raise ValueError("No LLM response received")

            logger.debug("Raw LLM response: %s", response.content)
            foods_with_grams, confidence = self._parse_response(response.content)
            foods = [
                item.get("food", "")
                for item in foods_with_grams
                if isinstance(item, dict) and item.get("food")
            ]

            if foods_with_grams:
                calories, protein, carbs, fat, fiber = self._calculate_macros_from_foods(foods_with_grams)
            else:
                calories, protein, carbs, fat, fiber = 0.0, 0.0, 0.0, 0.0, 0.0

            result = NutritionResponse(
                foods=foods,
                calories=calories,
                protein_grams=protein,
                carbs_grams=carbs,
                fat_grams=fat,
                fiber_grams=fiber,
                confidence=confidence,
            )

            logger.info(
                "Analysis complete: %.0f cal, %d foods, confidence %.2f",
                result.calories,
                len(result.foods),
                result.confidence,
            )
            return result
        except ValueError:
            raise
        except Exception as exc:
            logger.error("Unexpected error: %s", exc, exc_info=True)
            raise ValueError(f"Image analysis failed: {exc}") from exc

    def analyze_with_provider(self, image_base64: str, provider: str) -> NutritionAnalysisResult:
        """Analyze an image using one provider only, without fallback switching."""
        response = self._invoke_provider(image_base64, provider)
        if not response:
            raise ValueError(f"No LLM response received from {provider}")

        logger.debug("Raw %s response: %s", provider, response.content)
        foods_with_grams, confidence = self._parse_response(response.content)
        foods = [
            item.get("food", "")
            for item in foods_with_grams
            if isinstance(item, dict) and item.get("food")
        ]

        if foods_with_grams:
            calories, protein, carbs, fat, fiber = self._calculate_macros_from_foods(foods_with_grams)
        else:
            calories, protein, carbs, fat, fiber = 0.0, 0.0, 0.0, 0.0, 0.0

        return NutritionAnalysisResult(
            provider=provider,
            foods=foods,
            calories=calories,
            protein_grams=protein,
            carbs_grams=carbs,
            fat_grams=fat,
            fiber_grams=fiber,
            confidence=confidence,
        )

    def compare_providers(self, image_base64: str, secondary_provider: Optional[str] = None) -> NutritionComparisonResponse:
        """Compare calorie estimates from two LLM providers on the same image."""
        secondary = secondary_provider or self._default_compare_provider()
        primary_result = self.analyze_with_provider(image_base64, self.provider)
        secondary_result = self.analyze_with_provider(image_base64, secondary)
        calorie_difference = abs(primary_result.calories - secondary_result.calories)
        denominator = max(primary_result.calories, secondary_result.calories, 1.0)
        calorie_difference_percent = calorie_difference / denominator * 100.0

        return NutritionComparisonResponse(
            primary=primary_result,
            secondary=secondary_result,
            calorie_difference=calorie_difference,
            calorie_difference_percent=calorie_difference_percent,
        )

    def _invoke_provider(self, image_base64: str, provider: str):
        image_data = base64.b64decode(image_base64)
        img = Image.open(BytesIO(image_data))
        img_format = img.format or "JPEG"

        message = HumanMessage(
            content=[
                {"type": "text", "text": self._build_prompt()},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/{img_format.lower()};base64,{image_base64}"},
                },
            ]
        )

        llm = self._build_llm(provider)
        if not llm:
            return None

        logger.info("Calling %s for image analysis", provider)
        return llm.invoke([message])

    def _default_compare_provider(self) -> str:
        if self.provider == "google":
            return "ollama"
        return "google"

    def _parse_response(self, response_content: str) -> tuple[list[Dict[str, Any]], float]:
        if not response_content:
            return [], 0.1

        raw_text = response_content.strip()
        # Remove any triple-backtick fenced blocks (e.g. ```json {...} ```)
        raw_text = re.sub(r"```(?:json)?\s*(.*?)\s*```", r"\1", raw_text, flags=re.DOTALL | re.IGNORECASE)
        raw_text = raw_text.strip()

        payload = self._try_parse_json(raw_text)
        if payload is None:
            match = re.search(r"\{.*\}", raw_text, flags=re.DOTALL)
            if match:
                payload = self._try_parse_json(match.group(0))

        if not isinstance(payload, dict):
            # Try robust extractor for near-JSON/malformed responses
            foods_list, conf = self._extract_foods_from_malformed_json(raw_text)
            if foods_list:
                return foods_list, conf
            logger.warning("Failed to parse LLM response as JSON")
            # Last-resort: simple global regex for "food":"name","grams":num
            simple_matches = re.findall(r'"food"\s*:\s*"([^\"]+)"\s*,\s*"grams"\s*:\s*([0-9]*\.?[0-9]+)', raw_text)
            if simple_matches:
                parsed = []
                confidence = 0.1
                m_conf = re.search(r"\"confidence\"\s*:\s*([0-9]*\.?[0-9]+)", raw_text)
                if m_conf:
                    confidence = _coerce_float(m_conf.group(1))
                for fname, grams_str in simple_matches:
                    g = _coerce_float(grams_str)
                    g = self._normalize_grams(fname, g)
                    if fname and g > 0:
                        parsed.append({"food": fname, "grams": g})
                if parsed:
                    return parsed, confidence
            return [], 0.1

        foods = payload.get("foods", [])
        confidence = _coerce_float(payload.get("confidence", 0.1))
        confidence = max(0.0, min(confidence, 1.0))

        parsed_foods: list[Dict[str, Any]] = []
        if isinstance(foods, list):
            for item in foods:
                if not isinstance(item, dict):
                    continue
                food_name = str(item.get("food", "")).strip()
                grams = _coerce_float(item.get("grams", 0))
                grams = self._normalize_grams(food_name, grams)
                if food_name and grams > 0:
                    parsed_foods.append({"food": food_name, "grams": grams})

        return parsed_foods, confidence

    @staticmethod
    def _try_parse_json(text: str) -> Optional[Any]:
        try:
            return json.loads(text)
        except Exception:
            return None

    def _extract_foods_from_malformed_json(self, raw_text: str) -> tuple[list[Dict[str, Any]], float]:
        """Robust extractor for cases where the model returns near-JSON but malformed.

        Attempts to locate a `foods` array and `confidence` value using bracket
        matching and regex, then parses the fragments.
        """
        foods_list: list[Dict[str, Any]] = []
        confidence = 0.1

        # Find confidence if present anywhere
        m_conf = re.search(r"\"confidence\"\s*:\s*([0-9]*\.?[0-9]+)", raw_text)
        if m_conf:
            try:
                confidence = _coerce_float(m_conf.group(1))
            except Exception:
                confidence = 0.1

        # Find the foods array by locating the first '[' after '"foods"'
        m = re.search(r"\"foods\"\s*:\s*\[", raw_text)
        if not m:
            return [], confidence

        start = m.end() - 1
        # find matching closing bracket
        depth = 0
        end = None
        for i in range(start, len(raw_text)):
            ch = raw_text[i]
            if ch == '[':
                depth += 1
            elif ch == ']':
                depth -= 1
                if depth == 0:
                    end = i
                    break

        if end is None:
            return [], confidence

        foods_fragment = raw_text[start:end+1]
        # Try to parse the foods fragment as JSON array
        try:
            parsed = json.loads(foods_fragment)
            if isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict):
                        fname = str(item.get("food", "")).strip()
                        grams = _coerce_float(item.get("grams", 0))
                        grams = self._normalize_grams(fname, grams)
                        if fname and grams > 0:
                            foods_list.append({"food": fname, "grams": grams})
        except Exception:
            # best-effort: try to extract simple object pairs like {"food": "x", "grams": 123}
            for m_item in re.finditer(r"\{[^}]*\}", foods_fragment):
                try:
                    obj = json.loads(m_item.group(0))
                    fname = str(obj.get("food", "")).strip()
                    grams = _coerce_float(obj.get("grams", 0))
                    grams = self._normalize_grams(fname, grams)
                    if fname and grams > 0:
                        foods_list.append({"food": fname, "grams": grams})
                except Exception:
                    continue

        # Final fallback: extract simple "food"/"grams" pairs anywhere in text
        if not foods_list:
            for m_pair in re.finditer(r'"food"\s*:\s*"([^\"]+)"[^\}]{0,60}?"grams"\s*:\s*([0-9]*\.?[0-9]+)', raw_text, flags=re.DOTALL):
                try:
                    fname = m_pair.group(1).strip()
                    grams = _coerce_float(m_pair.group(2))
                    grams = self._normalize_grams(fname, grams)
                    if fname and grams > 0:
                        foods_list.append({"food": fname, "grams": grams})
                except Exception:
                    continue

        return foods_list, confidence

    def _normalize_grams(self, food_name: str, grams: float) -> float:
        """Apply simple heuristics to map implausible gram values to sensible defaults.

        Rules:
        - If grams <= 0 -> 0
        - If grams < 10 and the item is not a known small-portion spice, set a
          conservative minimum of 30 g.
        - Allow tiny amounts for spices (cinnamon, salt, pepper) below 10 g.
        - Cap extreme values above 2000 g to 2000 g.
        """
        try:
            g = float(grams)
        except Exception:
            return 0.0

        if g <= 0:
            return 0.0

        name = _normalize_food_name(food_name)
        small_portions = {"cinnamon", "salt", "pepper", "oregano", "nutmeg"}

        if g < 10 and name not in small_portions:
            return 30.0

        # Apply some per-item sensible caps for known outliers
        caps = {
            "bacon": 200.0,
            "egg": 300.0,
            "eggs": 300.0,
            "pizza slice": 400.0,
            "salad": 2000.0,
        }
        if name in caps:
            return min(g, caps[name])

        if g > 2000:
            return 2000.0

        return g

    def _decompose_food_name(self, normalized_name: str) -> list[str]:
        """Attempt a lightweight, rule-based decomposition of a dish name into candidate ingredients.

        Strategy:
        - Split by common delimiters (comma, '+', ' and ', '/') and try each segment.
        - For each segment, attempt a USDA lookup for the whole segment; if not found,
          split into words and try to match individual tokens (filter short words).
        - Return a list of unique candidate ingredient names (canonical forms via aliases).
        """
        if not normalized_name:
            return []

        # Try to map aliases first
        canonical = ALIASES.get(normalized_name, normalized_name)

        # Segmentation
        segments = re.split(r",|\+|/| and | with | & ", canonical)
        candidates: list[str] = []

        for seg in segments:
            seg = seg.strip()
            if not seg:
                continue

            # Try whole segment
            if self._lookup_food_nutrition(seg):
                candidates.append(seg)
                continue

            # Try tokens inside the segment (remove very short tokens)
            tokens = [t for t in re.split(r"\s+", seg) if len(t) > 3]
            for t in tokens:
                t_norm = ALIASES.get(t, t)
                if t_norm in candidates:
                    continue
                if self._lookup_food_nutrition(t_norm):
                    candidates.append(t_norm)

        # Remove duplicates while preserving order
        seen = set()
        unique = []
        for c in candidates:
            if c not in seen:
                seen.add(c)
                unique.append(c)

        return unique

    @staticmethod
    def _build_prompt() -> str:
        """Build the prompt for food image analysis."""
        # Minimal prompt: instruct the model only to return the JSON object and nothing else.
        # All examples and portion guidance have been removed so the model is not biased
        # by any hardcoded gram or calorie hints.
        return (
            "Return ONLY a single JSON object (no markdown, no extra text) in the exact shape:\n"
            "{\"foods\": [{\"food\": \"item\", \"grams\": 123}], \"confidence\": 0.9}\n"
            "If no food is visible, return {\"foods\": [], \"confidence\": 0.1}."
        )