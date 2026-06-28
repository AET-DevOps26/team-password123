// ── Types mirroring analytics-service DTOs ─────────────────────────────────

export interface AnalyticsResponse {
  from: string;               // ISO LocalDate
  to: string;
  mealCount: number;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
  calorieGoalDelta: number | null;
  proteinGoalDelta: number | null;
  carbsGoalDelta: number | null;
  fatGoalDelta: number | null;
  fiberGoalDelta: number | null;
}

export interface GoalResponse {
  id: string;
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
  updatedAt: string;
}

export interface GoalRequest {
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
}

export interface StreakResponse {
  streak: number;
}

export interface InsightFact {
  id: string;
  text: string;
}

export interface InsightResponse {
  insight: string | null;
  factsUsed: InsightFact[];
  generatedBy: string;
  result: string;
}
