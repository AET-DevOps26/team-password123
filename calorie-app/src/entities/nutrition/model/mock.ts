import type { NutritionGoal, DailyProgress, DailyStats } from './types';

export const MOCK_GOAL: NutritionGoal = {
  calories: 2000,
  protein: 120,
  carbs: 220,
  fat: 65,
};

export const MOCK_TODAY: DailyProgress = {
  dateLabel: 'Today, Thu 28 May',
  consumed: 1340,
  protein: 78,
  carbs: 145,
  fat: 42,
};

export const MOCK_STATS: DailyStats = {
  weekAvg: 2050,
  goalAdherence: 0.86,
  streak: 12,
};
