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

/** UI-only: a meal entry shown in Today / Diary lists */
export interface MealEntry {
  id: string;
  slot: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
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
