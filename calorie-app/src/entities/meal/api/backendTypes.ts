// ── Types mirroring the meals-service DTOs ─────────────────────────────────

export type BackendMealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
export type BackendSourceType = 'MANUAL' | 'PHOTO_MANUAL' | 'PHOTO_AI';
export type BackendPhotoStatus = 'AI_NOT_AVAILABLE' | 'MANUALLY_COMPLETED' | 'ANALYZED';

export interface MealItemResponse {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
}

export interface MealResponse {
  id: string;
  mealType: BackendMealType;
  loggedAt: string;           // ISO-8601 OffsetDateTime
  sourceType: BackendSourceType;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
  notes: string | null;
  photoUrl: string | null;    // `/api/meals/photo/:id/raw` when a photo is linked
  items: MealItemResponse[];
}

export interface MealItemRequest {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
}

export interface ManualMealRequest {
  mealType: BackendMealType;
  loggedAt: string;           // ISO-8601 OffsetDateTime
  notes: string;
  items: MealItemRequest[];
}

export interface PhotoLogResponse {
  id: string;
  originalFilename: string;
  contentType: string;
  status: BackendPhotoStatus;
  linkedMealLogId: string | null;
  createdAt: string;
}
