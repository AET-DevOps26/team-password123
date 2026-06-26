import type { NutritionInfo } from '../../nutrition';

export interface Meal {
  id: number;
  userId: number;
  dishName: string;
  imageUrl: string;
  nutrition: NutritionInfo;
  confidence: number;
  analyzedAt: string;
}

export interface MealAnalysisResponse {
  meal: Meal;
  message: string;
}

/** The four meal slots used across the app. Single source of truth. */
export type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

/** UI domain type for an AI food estimate (camelCase, mapped from the backend) */
export interface FoodEstimate {
  foodName: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  typicalPortionGrams: number;
  typicalPortionLabel: string;
  source: string;
  confidence: number;
}

/** UI-only: a meal entry shown in Today / Diary lists */
export interface MealEntry {
  id: string;
  slot: MealSlot;
  time: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tone: string;
  /** The user's meal photo. Either a backend `/api/meals/photo/:id/raw` path
   *  (fetched with auth) or a local data:/blob: URL for just-scanned meals. */
  imageUrl?: string;
}
