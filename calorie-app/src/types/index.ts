// ============================================================
// Nutrition data
// ============================================================

export interface NutritionInfo {
  calories: number;  // kcal
  protein: number;   // grams
  fat: number;       // grams
  carbs: number;     // grams
}

// ============================================================
// Meal / photo analysis (MealController)
// ============================================================

export interface Meal {
  id: number;
  userId: number;
  dishName: string;          // dish name recognized by AI
  imageUrl: string;          // URL of the uploaded photo
  nutrition: NutritionInfo;
  confidence: number;        // AI confidence 0–1, e.g. 0.87
  analyzedAt: string;        // ISO date
}

// The photo is sent as FormData — no separate request type needed.
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
