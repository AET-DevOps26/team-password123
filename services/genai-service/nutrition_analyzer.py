"""
Nutrition analyzer using LangChain with Ollama (local) and OpenAI (cloud fallback).

Architecture:
- Default: Ollama (free, local, runs offline)
- Fallback: OpenAI GPT-4o (paid, cloud, higher accuracy)
- LangChain abstracts the provider, so switching is transparent
"""

import base64
import logging
import json
from io import BytesIO
from pathlib import Path
from PIL import Image
from typing import Optional, Dict
from pydantic import BaseModel

from langchain_core.messages import HumanMessage
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

from config import (
    LLM_PROVIDER,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OPENAI_API_KEY,
    OPENAI_MODEL,
)

logger = logging.getLogger(__name__)


class NutritionResponse(BaseModel):
    """Response from the nutrition analyzer."""
    foods: list[str]
    calories: float
    protein_grams: float
    carbs_grams: float
    fat_grams: float
    fiber_grams: float
    confidence: float


class NutritionAnalyzer:
    """Analyzes food images and returns nutritional estimates using LangChain."""

    def __init__(self):
        self.provider = LLM_PROVIDER
        self.llm = None
        self.fallback_llm = None
        self.nutrition_db = self._load_nutrition_db()
        
        # Initialize primary provider
        if self.provider == "ollama":
            try:
                logger.info(f"Initializing Ollama at {OLLAMA_BASE_URL} with model {OLLAMA_MODEL}")
                self.llm = ChatOllama(
                    base_url=OLLAMA_BASE_URL,
                    model=OLLAMA_MODEL,
                    temperature=0,  # Deterministic output
                )
                # Test connectivity
                test = self.llm.invoke("test")
                logger.info("Ollama initialized successfully")
            except Exception as e:
                logger.warning(f"Ollama initialization failed: {e}. Will use OpenAI fallback.")
                self.llm = None
        
        elif self.provider == "openai":
            try:
                logger.info(f"Initializing OpenAI with model {OPENAI_MODEL}")
                self.llm = ChatOpenAI(
                    model=OPENAI_MODEL,
                    api_key=OPENAI_API_KEY,
                    temperature=0,
                    max_tokens=1024,
                )
                logger.info("OpenAI initialized successfully")
            except Exception as e:
                logger.error(f"OpenAI initialization failed: {e}")
                self.llm = None
        
        # Initialize fallback provider (opposite of primary)
        if self.provider == "ollama" and OPENAI_API_KEY:
            try:
                logger.info("Setting up OpenAI as fallback")
                self.fallback_llm = ChatOpenAI(
                    model=OPENAI_MODEL,
                    api_key=OPENAI_API_KEY,
                    temperature=0,
                    max_tokens=1024,
                )
            except Exception as e:
                logger.warning(f"OpenAI fallback setup failed: {e}")
        
        elif self.provider == "openai":
            try:
                logger.info("Setting up Ollama as fallback")
                self.fallback_llm = ChatOllama(
                    base_url=OLLAMA_BASE_URL,
                    model=OLLAMA_MODEL,
                    temperature=0,
                )
            except Exception as e:
                logger.warning(f"Ollama fallback setup failed: {e}")
        
        if not self.llm and not self.fallback_llm:
            raise RuntimeError(
                "No LLM provider available. Check Ollama is running (http://localhost:11434) "
                "or set OPENAI_API_KEY for fallback."
            )

    @staticmethod
    def _load_nutrition_db() -> Dict:
        """Load nutrition database from JSON file."""
        try:
            db_path = Path(__file__).parent / "nutrition_db.json"
            with open(db_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load nutrition database: {e}")
            return {}

    def _lookup_food_nutrition(self, food_name: str) -> Optional[Dict]:
        """
        Look up nutritional data for a food item.
        
        Args:
            food_name: Name of the food (will be normalized to lowercase)
            
        Returns:
            Dict with nutrition data per 100g, or None if not found
        """
        normalized_name = food_name.lower().strip()
        
        # Direct lookup
        if normalized_name in self.nutrition_db:
            return self.nutrition_db[normalized_name]
        
        # Fuzzy match (check if food name is substring of db entry)
        for db_key, db_val in self.nutrition_db.items():
            if normalized_name in db_key or db_key in normalized_name:
                logger.debug(f"Fuzzy matched '{food_name}' -> '{db_key}'")
                return db_val
        
        logger.warning(f"Nutrition data not found for: {food_name}")
        return None

    def _calculate_macros_from_foods(self, foods_with_grams: list) -> tuple:
        """
        Calculate total macros from identified foods with portion sizes.
        
        Args:
            foods_with_grams: List of {"food": name, "grams": amount}
            
        Returns:
            Tuple of (calories, protein, carbs, fat, fiber)
        """
        total_calories = 0.0
        total_protein = 0.0
        total_carbs = 0.0
        total_fat = 0.0
        total_fiber = 0.0

        for item in foods_with_grams:
            if not isinstance(item, dict):
                continue
            
            food_name = item.get("food", "").strip()
            grams = float(item.get("grams", 0))
            
            if not food_name or grams <= 0:
                continue
            
            nutrition = self._lookup_food_nutrition(food_name)
            if not nutrition:
                # Use generic estimates if not found
                logger.warning(f"Using generic estimate for: {food_name}")
                nutrition = {
                    "calories_per_100g": 150,
                    "protein_per_100g": 10,
                    "carbs_per_100g": 20,
                    "fat_per_100g": 5,
                    "fiber_per_100g": 2
                }
            
            # Scale macros by portion size
            multiplier = grams / 100.0
            total_calories += nutrition.get("calories_per_100g", 0) * multiplier
            total_protein += nutrition.get("protein_per_100g", 0) * multiplier
            total_carbs += nutrition.get("carbs_per_100g", 0) * multiplier
            total_fat += nutrition.get("fat_per_100g", 0) * multiplier
            total_fiber += nutrition.get("fiber_per_100g", 0) * multiplier
            
            logger.debug(f"{food_name} ({grams}g): {nutrition.get('calories_per_100g', 0) * multiplier:.0f} cal")
        
        return (total_calories, total_protein, total_carbs, total_fat, total_fiber)

    def analyze(self, image_base64: str) -> NutritionResponse:
        """
        Analyze a base64-encoded food image and return nutrition estimates.
        
        Architecture:
        1. Vision model (llava) identifies foods and estimates portions in grams
        2. Lookup table provides accurate nutritional data per 100g
        3. Calculate final macros based on portion sizes
        
        Args:
            image_base64: Base64-encoded image string
            
        Returns:
            NutritionResponse with estimated macros
        """
        try:
            # Validate the image
            image_data = base64.b64decode(image_base64)
            img = Image.open(BytesIO(image_data))
            img_format = img.format or "JPEG"
            
            # Build the vision prompt
            # LangChain vision format: HumanMessage with image_url
            message = HumanMessage(
                content=[
                    {
                        "type": "text",
                        "text": self._build_prompt(),
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/{img_format.lower()};base64,{image_base64}",
                        },
                    },
                ],
            )
            
            # Try primary LLM first
            response = None
            if self.llm:
                try:
                    logger.info(f"Calling {self.provider} for image analysis")
                    response = self.llm.invoke([message])
                except Exception as e:
                    logger.warning(f"Primary LLM failed: {e}. Trying fallback...")
            
            # Fall back to secondary LLM if primary fails
            if not response and self.fallback_llm:
                try:
                    logger.info("Calling fallback LLM")
                    response = self.fallback_llm.invoke([message])
                except Exception as e:
                    logger.error(f"Fallback LLM also failed: {e}")
                    raise ValueError(f"All LLM providers failed: {e}")
            
            if not response:
                raise ValueError("No LLM response received")
            
            # Log raw response for debugging
            logger.debug(f"Raw LLM response: {response.content}")
            
            # Parse the response to get foods with grams
            foods_with_grams, confidence = self._parse_response(response.content)
            logger.info(f"Foods identified: {foods_with_grams}, confidence: {confidence}")
            
            # Extract food names for the response
            foods = [item.get("food", "") for item in foods_with_grams if isinstance(item, dict) and item.get("food")]
            
            # Calculate macros based on portion sizes
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
            
            logger.info(f"Analysis complete: {result.calories:.0f} cal, {len(foods)} foods, confidence {result.confidence}")
            return result
            
        except ValueError as e:
            logger.error(f"Analysis error: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            raise ValueError(f"Image analysis failed: {str(e)}")

    @staticmethod
    def _build_prompt() -> str:
        """Build the prompt for food image analysis."""
        return """Analyze this food image and identify the food items with portion estimates.

Return ONLY a valid JSON object in this exact format (no markdown, no extra text):
{"foods": [{"food": "chicken", "grams": 150}, {"food": "broccoli", "grams": 100}], "confidence": 0.9}

CRITICAL REQUIREMENTS:
1. Identify EACH distinct food item visible (list separately, not combined)
2. Estimate portion size in GRAMS for each food item
   - Typical chicken breast: 150-200g
   - Typical vegetable serving: 80-150g
   - Typical rice/pasta serving: 150-200g
3. Use realistic gram estimates based on visual portion size
4. Confidence: 0.0-1.0 (0.8+ if foods clearly visible, <0.5 if unclear/blurry)
5. foods MUST be an array of objects with "food" and "grams" keys (both strings/numbers)
6. NO markdown, NO explanations, ONLY the JSON object
7. If no foods visible, return: {"foods": [], "confidence": 0.1}

Example responses:
- See hamburger + fries: {"foods": [{"food": "hamburger", "grams": 180}, {"food": "fries", "grams": 120}], "confidence": 0.95}
- See chicken + rice + broccoli: {"foods": [{"food": "chicken", "grams": 200}, {"food": "rice", "grams": 150}, {"food": "broccoli", "grams": 100}], "confidence": 0.9}

CRITICAL: Return actual food names (lowercase, singular/plural ok). Do NOT return placeholders.
"""

    @staticmethod
    def _parse_response(response_text: str) -> NutritionResponse:
        """Parse the LLM response into a NutritionResponse."""
        import json
        import re

        # Try to extract JSON from the response. Models sometimes wrap JSON in
        # markdown code blocks, or return fields as plain text (e.g. foods as
        # a comma-separated string). Normalize into expected types.
        try:
            # Remove markdown code blocks if present
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]

            data = json.loads(response_text.strip())

            # Normalize foods field to a list of strings
            foods_raw = data.get("foods", [])
            foods = []
            if isinstance(foods_raw, str):
                # Try to parse a stringified JSON list first
                try:
                    parsed = json.loads(foods_raw)
                    if isinstance(parsed, (list, tuple)):
                        foods = [str(x) for x in parsed]
                    else:
                        foods = [str(parsed)]
                except Exception:
                    # Fall back to splitting on commas/newlines and cleaning
                    parts = re.split(r"[,;\n]", foods_raw)
                    foods = [p.strip().strip('"\'') for p in parts if p.strip()]

            elif isinstance(foods_raw, (list, tuple)):
                # Flatten nested lists and convert to strings
                for item in foods_raw:
                    if isinstance(item, (list, tuple)):
                        foods.extend([str(x) for x in item])
                    else:
                        foods.append(str(item))
            else:
                # Unknown type; coerce to string
                foods = [str(foods_raw)]

            # Detect placeholder responses like ["list","of","identified","foods"]
            placeholder_tokens = {"list", "of", "identified", "foods"}
            lower_foods = {f.lower() for f in foods}
            if placeholder_tokens.issubset(lower_foods) or lower_foods <= placeholder_tokens:
                logger.warning("Model returned placeholder foods list; treating as unknown.")
                foods = []

            # Return values provided by the model (normalized foods list)
            return NutritionResponse(
                foods=foods,
                calories=float(data.get("calories", 500)),
                protein_grams=float(data.get("protein_grams", 25)),
                carbs_grams=float(data.get("carbs_grams", 60)),
                fat_grams=float(data.get("fat_grams", 15)),
                fiber_grams=float(data.get("fiber_grams", 5)),
                confidence=float(data.get("confidence", 0.0)),
            )
        except json.JSONDecodeError:
            logger.error(f"Failed to parse JSON response: {response_text}")
            # Return placeholder on parse error
            return NutritionResponse(
                foods=["Unable to parse"],
                calories=0,
                protein_grams=0,
                carbs_grams=0,
                fat_grams=0,
                fiber_grams=0,
                confidence=0.0,
            )

