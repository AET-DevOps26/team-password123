export interface NutritionInfo {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface NutritionGoal {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DailyProgress {
  dateLabel: string;
  consumed: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DailyStats {
  weekAvg: number;
  goalAdherence: number;
  streak: number;
}
