import { create } from 'zustand';
import type { MealEntry } from './types';

interface MealStore {
  entries: MealEntry[];
  addEntry:   (entry: MealEntry) => void;
  setEntries: (entries: MealEntry[]) => void;
  clearEntries: () => void;
}

export const useMealStore = create<MealStore>((set) => ({
  entries: [],

  addEntry:    (entry)   => set((s) => ({ entries: [entry, ...s.entries] })),
  setEntries:  (entries) => set({ entries }),
  clearEntries: ()       => set({ entries: [] }),
}));
