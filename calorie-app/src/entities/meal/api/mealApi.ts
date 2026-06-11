import { apiClient } from '../../../shared/api/client';
import type { MealAnalysisResponse } from '../model/types';
import type { MealResponse, ManualMealRequest, PhotoLogResponse } from './backendTypes';

export const mealApi = {
  /** POST /meals/manual — persist a manually-entered meal */
  saveManual: (request: ManualMealRequest): Promise<MealResponse> =>
    apiClient.post<MealResponse>('/meals/manual', request),

  /** GET /meals?from=DATE&to=DATE — fetch meals for a date range (ISO dates) */
  getHistory: (from: string, to: string): Promise<MealResponse[]> =>
    apiClient.get<MealResponse[]>(`/meals?from=${from}&to=${to}`),

  /** GET /meals/:id */
  getById: (id: string): Promise<MealResponse> =>
    apiClient.get<MealResponse>(`/meals/${id}`),

  /** DELETE /meals/:id */
  delete: (id: string): Promise<null> =>
    apiClient.delete<null>(`/meals/${id}`),

  /** POST /meals/photo — upload a photo; backend stores it and returns status */
  uploadPhoto: (imageFile: File): Promise<PhotoLogResponse> => {
    const formData = new FormData();
    formData.append('file', imageFile);
    return apiClient.post<PhotoLogResponse>('/meals/photo', formData);
  },

  /** POST /meals/photo/:id/convert-manual — attach nutrition data to an uploaded photo */
  convertPhotoToMeal: (photoId: string, request: ManualMealRequest): Promise<MealResponse> =>
    apiClient.post<MealResponse>(`/meals/photo/${photoId}/convert-manual`, request),

  /**
   * POST /meals/analyze — send the photo to the GenAI vision model. The backend
   * analyzes, persists the meal, and returns the recognized dish + macros.
   */
  analyzePhoto: (imageFile: File): Promise<MealAnalysisResponse> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    return apiClient.post<MealAnalysisResponse>('/meals/analyze', formData);
  },
};
