import { apiClient } from '../../../shared/api/client';
import type { AnalyticsResponse, InsightResponse, StreakResponse } from './backendTypes';

export const analyticsApi = {
  /** GET /analytics/daily?date=YYYY-MM-DD */
  getDaily: (date: string): Promise<AnalyticsResponse> =>
    apiClient.get<AnalyticsResponse>(`/analytics/daily?date=${date}`),

  /** GET /analytics/weekly?weekStart=YYYY-MM-DD */
  getWeekly: (weekStart: string): Promise<AnalyticsResponse> =>
    apiClient.get<AnalyticsResponse>(`/analytics/weekly?weekStart=${weekStart}`),

  /** GET /analytics/streak */
  getStreak: (): Promise<StreakResponse> =>
    apiClient.get<StreakResponse>('/analytics/streak'),

  /** GET /analytics/insight?window=week — RAG health insight (null/unavailable when not generated) */
  getInsight: (window = 'week'): Promise<InsightResponse> =>
    apiClient.get<InsightResponse>(`/analytics/insight?window=${window}`),
};
