import { apiClient } from '../../../shared/api/client';
import { clientTimeZone } from '../../../shared/lib/timezone';
import type { AnalyticsResponse, InsightResponse, StreakResponse } from './backendTypes';

// The client's zone travels on every call so day/week/streak boundaries match
// the calendar the user sees rather than UTC.
const tz = () => `tz=${encodeURIComponent(clientTimeZone())}`;

export const analyticsApi = {
  /** GET /analytics/daily?date=YYYY-MM-DD */
  getDaily: (date: string): Promise<AnalyticsResponse> =>
    apiClient.get<AnalyticsResponse>(`/analytics/daily?date=${date}&${tz()}`),

  /** GET /analytics/weekly?weekStart=YYYY-MM-DD */
  getWeekly: (weekStart: string): Promise<AnalyticsResponse> =>
    apiClient.get<AnalyticsResponse>(`/analytics/weekly?weekStart=${weekStart}&${tz()}`),

  /** GET /analytics/streak */
  getStreak: (): Promise<StreakResponse> =>
    apiClient.get<StreakResponse>(`/analytics/streak?${tz()}`),

  /** GET /analytics/insight?window=week — RAG health insight (null/unavailable when not generated) */
  getInsight: (window = 'week'): Promise<InsightResponse> =>
    apiClient.get<InsightResponse>(`/analytics/insight?window=${window}&${tz()}`),
};
