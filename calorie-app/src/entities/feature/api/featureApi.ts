import { apiClient } from '../../../shared/api/client';
import type { FeatureName } from './features';

export const featureApi = {
  get: (name: FeatureName): Promise<boolean> =>
    apiClient.get<boolean>(`/features/${name}`),

  /** All toggles currently stored on the server (may be empty). */
  list: (): Promise<Record<string, boolean>> =>
    apiClient.get<Record<string, boolean>>('/features'),
};
