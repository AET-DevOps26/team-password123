export interface NutritionInfo {
  calories: number; // kcal
  protein: number; // grams
  fat: number; // grams
  carbs: number; // grams
}

export interface Meal {
  id: number;
  userId: number;
  dishName: string; // dish name recognized by AI
  imageUrl: string; // URL of the uploaded photo
  nutrition: NutritionInfo;
  confidence: number;  // 0–1
  analyzedAt: string;  // ISO date
}

export interface MealAnalysisResponse {
  meal: Meal;
  message: string;
}

// ============================================================
// UI helper types
// ============================================================

export type LoadingStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ApiError {
  message: string;
  status: number;
}
