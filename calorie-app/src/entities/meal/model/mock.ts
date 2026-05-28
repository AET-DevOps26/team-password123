import type { MealEntry } from './types';

export const MOCK_MEALS: MealEntry[] = [
  { id: 'm1', slot: 'Breakfast', time: '08:15', name: 'Greek yogurt & berry bowl',    calories: 320, protein: 22, carbs: 38, fat: 9,  tone: '#e8d9c4' },
  { id: 'm2', slot: 'Lunch',     time: '13:05', name: 'Quinoa & avocado salad',        calories: 550, protein: 19, carbs: 61, fat: 24, tone: '#cfe0c9' },
  { id: 'm3', slot: 'Snack',     time: '16:40', name: 'Apple & a handful of almonds', calories: 210, protein: 6,  carbs: 27, fat: 11, tone: '#e4d2cf' },
  { id: 'm4', slot: 'Snack',     time: '11:00', name: 'Flat white',                    calories: 120, protein: 7,  carbs: 10, fat: 6,  tone: '#dcd6cc' },
];
