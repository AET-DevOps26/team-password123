import { create } from 'zustand';
import type { MealEntry } from './types';
import { MOCK_MEALS } from './mock';
import { MOCK_MODE } from '../../../shared/config/flags';

interface MealStore {
  entries: MealEntry[];
  addEntry: (entry: MealEntry) => void;
  clearEntries: () => void;
}

export const useMealStore = create<MealStore>((set) => ({
  entries: MOCK_MODE ? MOCK_MEALS : [],

  addEntry: (entry) =>
    set((state) => ({ entries: [entry, ...state.entries] })),

  clearEntries: () => set({ entries: [] }),
}));
