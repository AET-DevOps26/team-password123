import { create } from 'zustand';
import { featureApi } from '../api/featureApi';
import { ALL_FEATURES, type FeatureName } from './features';

interface FeatureToggleState {
  toggles: Partial<Record<FeatureName, boolean>>;
  loaded: boolean;
  load: () => Promise<void>;
  isEnabled: (name: FeatureName) => boolean;
}

export const useFeatureToggleStore = create<FeatureToggleState>((set, get) => ({
  toggles: {},
  loaded: false,

  load: async () => {
    const results = await Promise.allSettled(
      ALL_FEATURES.map(async (name) => [name, await featureApi.get(name)] as const),
    );
    const toggles: Partial<Record<FeatureName, boolean>> = {};
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const [name, enabled] = result.value;
        toggles[name] = enabled;
      }
    }
    set({ toggles, loaded: true });
  },

  isEnabled: (name) => get().toggles[name] ?? false,
}));

/** Convenience hook for a single flag (defaults false until loaded). */
export function useFeatureToggle(name: FeatureName): boolean {
  return useFeatureToggleStore((s) => s.toggles[name] ?? false);
}
