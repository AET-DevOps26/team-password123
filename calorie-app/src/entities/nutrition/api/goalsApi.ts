import { apiClient } from '../../../shared/api/client';
import type { GoalResponse, GoalRequest } from './backendTypes';

export const goalsApi = {
  /** GET /goals — returns null (204) when no goals have been set yet */
  get: (): Promise<GoalResponse | null> =>
    apiClient.get<GoalResponse | null>('/goals'),

  /** PUT /goals — create or replace goals */
  save: (request: GoalRequest): Promise<GoalResponse> =>
    apiClient.put<GoalResponse>('/goals', request),
};
