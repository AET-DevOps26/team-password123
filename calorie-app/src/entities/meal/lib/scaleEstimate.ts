import type { FoodEstimate } from '../model/types';

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
