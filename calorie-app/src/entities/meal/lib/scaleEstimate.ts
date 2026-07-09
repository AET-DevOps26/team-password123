import type { FoodEstimate } from '../model/types';
import type { NutritionInfo } from '../../nutrition/model/types';

export interface ScaledNutrition {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}

/** Scale per-100g estimate data to a given portion size in grams. */
export function scaleEstimate(e: FoodEstimate, grams: number): ScaledNutrition {
  const m = grams / 100;
  return {
    calories:     Math.round(e.caloriesPer100g * m),
    proteinGrams: Math.round(e.proteinPer100g * m * 10) / 10,
    carbsGrams:   Math.round(e.carbsPer100g   * m * 10) / 10,
    fatGrams:     Math.round(e.fatPer100g     * m * 10) / 10,
  };
}

/** Scale a meal's total nutrition when the user adjusts portion grammage. */
export function scaleMealNutrition(
  base: NutritionInfo,
  baseGrams: number,
  targetGrams: number,
): NutritionInfo {
  if (baseGrams <= 0 || targetGrams <= 0) {
    return { ...base };
  }
  const m = targetGrams / baseGrams;
  return {
    calories: Math.round(base.calories * m),
    protein:  Math.round(base.protein * m * 10) / 10,
    carbs:    Math.round(base.carbs * m * 10) / 10,
    fat:      Math.round(base.fat * m * 10) / 10,
  };
}
