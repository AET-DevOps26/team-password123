import { create } from 'zustand';
import type { MealEntry } from './types';
import { MOCK_MEALS } from './mock';

interface MealStore {
  entries: MealEntry[];
  addEntry: (entry: MealEntry) => void;
  clearEntries: () => void;
}

export const useMealStore = create<MealStore>((set) => ({
  entries: MOCK_MEALS,

  addEntry: (entry) =>
    set((state) => ({ entries: [entry, ...state.entries] })),

  clearEntries: () => set({ entries: [] }),
}));
