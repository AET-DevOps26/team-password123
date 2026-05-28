import { apiClient } from '../../../shared/api/client';
import type { Meal, MealAnalysisResponse } from '../model/types';

export const mealApi = {
  analyzePhoto: (imageFile: File): Promise<MealAnalysisResponse> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    return apiClient.post<MealAnalysisResponse>('/meals/analyze', formData);
  },

  getHistory: (): Promise<Meal[]> =>
    apiClient.get<Meal[]>('/meals'),

  getById: (id: number): Promise<Meal> =>
    apiClient.get<Meal>(`/meals/${id}`),

  delete: (id: number): Promise<null> =>
    apiClient.delete<null>(`/meals/${id}`),
};
