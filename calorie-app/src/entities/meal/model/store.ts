import { create } from 'zustand';
import type { MealEntry } from './types';

interface MealStore {
  entries: MealEntry[];
  addEntry:     (entry: MealEntry) => void;
  updateEntry:  (entry: MealEntry) => void;
  removeEntry:  (id: string) => void;
  setEntries:   (entries: MealEntry[]) => void;
}

export const useMealStore = create<MealStore>((set) => ({
  entries: [],

  addEntry: (entry) =>
    set((s) => ({ entries: [entry, ...s.entries] })),

  updateEntry: (entry) =>
    set((s) => ({
      entries: s.entries.map((e) => (e.id === entry.id ? entry : e)),
    })),

  removeEntry: (id) =>
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

  setEntries:   (entries) => set({ entries }),
}));
