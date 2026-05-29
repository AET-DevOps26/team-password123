import { create } from 'zustand';

export type Sex = 'female' | 'male' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
export type GoalKind = 'lose' | 'maintain' | 'gain';

export interface UserGoals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  water: number;
}

export interface UserProfile {
  displayName: string;
  heightCm: number;
  weightKg: number;
  age: number;
  sex: Sex;
  activity: ActivityLevel;
  goal: GoalKind;
  goals: UserGoals;
  remindersEnabled: boolean;
  onboardingComplete: boolean;
}

const DEFAULTS: UserProfile = {
  displayName: 'Me',
  heightCm: 170,
  weightKg: 70,
  age: 30,
  sex: 'female',
  activity: 'moderate',
  goal: 'maintain',
  goals: { calories: 2000, protein: 130, carbs: 250, fats: 70, water: 2000 },
  remindersEnabled: false,
  onboardingComplete: false,
};

const STORAGE_KEY = 'userProfile';

function load(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<UserProfile>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function save(p: UserProfile) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

// Mifflin-St Jeor TDEE → macro split
export function calculateGoals(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex,
  activity: ActivityLevel,
  goal: GoalKind,
): UserGoals {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = sex === 'male' ? base + 5 : sex === 'female' ? base - 161 : base - 78;

  const multipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryActive: 1.9,
  };
  const adjustments: Record<GoalKind, number> = { lose: -500, maintain: 0, gain: 400 };

  const tdee = bmr * multipliers[activity];
  const calories = Math.max(1200, Math.round(tdee + adjustments[goal]));

  return {
    calories,
    protein: Math.round((calories * 0.30) / 4),
    carbs:   Math.round((calories * 0.40) / 4),
    fats:    Math.round((calories * 0.30) / 9),
    water:   2000,
  };
}

interface ProfileStore extends UserProfile {
  patch: (updates: Partial<UserProfile>) => void;
  reset: () => void;
}

export const useProfileStore = create<ProfileStore>((set) => ({
  ...load(),

  patch(updates) {
    set((state) => {
      const next = { ...state, ...updates };
      save(next);
      return next;
    });
  },

  reset() {
    save(DEFAULTS);
    set(DEFAULTS);
  },
}));
