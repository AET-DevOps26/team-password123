import type { MealEntry, MealSlot, FoodEstimate } from './types';
import type { MealResponse, ManualMealRequest, MealItemRequest, FoodEstimateResponse } from '../api/backendTypes';

const MEAL_TYPE_TO_SLOT: Record<string, MealSlot> = {
  BREAKFAST: 'Breakfast',
  LUNCH:     'Lunch',
  DINNER:    'Dinner',
  SNACK:     'Snack',
};

export const SLOT_TO_MEAL_TYPE: Record<MealSlot, string> = {
  Breakfast: 'BREAKFAST',
  Lunch:     'LUNCH',
  Dinner:    'DINNER',
  Snack:     'SNACK',
};

const SLOT_TONES: Record<MealSlot, string> = {
  Breakfast: '#e8d9c4',
  Lunch:     '#cfe0c9',
  Dinner:    '#d4d9e8',
  Snack:     '#e4d2cf',
};

/** Convert a backend MealResponse into a UI MealEntry */
export function mealResponseToEntry(r: MealResponse): MealEntry {
  const slot = MEAL_TYPE_TO_SLOT[r.mealType] ?? 'Lunch';
  const dt   = new Date(r.loggedAt);
  const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  const name = r.notes?.trim() || (r.items[0]?.name ?? slot);

  return {
    id:       r.id,
    slot,
    time,
    name,
    calories: Math.round(r.calories),
    protein:  Math.round(r.proteinGrams),
    carbs:    Math.round(r.carbsGrams),
    fat:      Math.round(r.fatGrams),
    tone:     SLOT_TONES[slot],
    imageUrl: r.photoUrl ?? undefined,
  };
}

/**
 * Build a ManualMealRequest from a MealEntry + individual items.
 * When items are not available (e.g. scan result), a single synthetic item is created.
 */
export function entryToManualRequest(
  slot: MealSlot,
  name: string,
  loggedAt: Date,
  items: MealItemRequest[],
): ManualMealRequest {
  return {
    mealType: SLOT_TO_MEAL_TYPE[slot] as ManualMealRequest['mealType'],
    loggedAt: loggedAt.toISOString(),
    notes:    name,
    items,
  };
}

/** Convert a backend FoodEstimateResponse into a clean UI FoodEstimate */
export function foodEstimateResponseToEstimate(r: FoodEstimateResponse): FoodEstimate {
  return {
    foodName:            r.foodName ?? r.food_name ?? '',
    caloriesPer100g:     r.caloriesPer100g ?? r.calories_per_100g ?? 0,
    proteinPer100g:      r.proteinPer100g ?? r.protein_grams_per_100g ?? 0,
    carbsPer100g:        r.carbsPer100g ?? r.carbs_grams_per_100g ?? 0,
    fatPer100g:          r.fatPer100g ?? r.fat_grams_per_100g ?? 0,
    typicalPortionGrams: r.typicalPortionGrams ?? r.typical_portion_grams ?? 100,
    typicalPortionLabel: r.typicalPortionLabel ?? r.typical_portion_label ?? '100 g',
    source:              r.source,
    confidence:          r.confidence,
  };
}

/** Create a single synthetic MealItemRequest from aggregate macros */
export function singleItemFromMacros(
  name: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
): MealItemRequest {
  return {
    name,
    quantity: 1,
    unit:     'serving',
    calories,
    proteinGrams: protein,
    carbsGrams:   carbs,
    fatGrams:     fat,
    fiberGrams:   0,
  };
}
