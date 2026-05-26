import { apiClient } from './client';
import type { Meal, MealAnalysisResponse } from '../types';

export const mealApi = {
  // POST /api/meals/analyze
  // Sends the photo as FormData (key "image")
  analyzePhoto: (imageFile: File): Promise<MealAnalysisResponse> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    return apiClient.post<MealAnalysisResponse>('/meals/analyze', formData);
  },

  // GET /api/meals — full history of meals for the current user
  getHistory: (): Promise<Meal[]> =>
    apiClient.get<Meal[]>('/meals'),

  // GET /api/meals/:id — single meal by id
  getById: (id: number): Promise<Meal> =>
    apiClient.get<Meal>(`/meals/${id}`),

  // DELETE /api/meals/:id — remove a record from history
  delete: (id: number): Promise<null> =>
    apiClient.delete<null>(`/meals/${id}`),
};
