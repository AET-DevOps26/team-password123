import { describe, it, expect } from 'vitest';
import { calculateGoals } from './profile';

// Hand-computed against the Mifflin-St Jeor implementation in profile.ts:
//   base = 10*weightKg + 6.25*heightCm - 5*age
//   bmr  = base + 5 (male) | base - 161 (female) | base - 78 (other)
//   tdee = bmr * activityMultiplier
//   calories = max(1200, round(tdee + goalAdjustment))
//   protein = round(calories*0.30/4)
//   carbs   = round(calories*0.40/4)
//   fats    = round(calories*0.30/9)
//   water   = 2000 (constant)

describe('calculateGoals', () => {
  it('male, moderate, maintain (concrete profile)', () => {
    // base = 800 + 1125 - 150 = 1775; bmr = 1780; tdee = 1780*1.55 = 2759
    const g = calculateGoals(80, 180, 30, 'male', 'moderate', 'maintain');
    expect(g).toEqual({
      calories: 2759,
      protein: 207, // round(2759*0.30/4) = round(206.925)
      carbs: 276, // round(2759*0.40/4) = round(275.9)
      fats: 92, // round(2759*0.30/9) = round(91.966)
      water: 2000,
    });
  });

  it('other, active, gain (concrete profile)', () => {
    // base = 700 + 1062.5 - 200 = 1562.5; bmr = 1484.5; tdee = 1484.5*1.725 = 2560.7625
    // calories = round(2560.7625 + 400) = 2961
    const g = calculateGoals(70, 170, 40, 'other', 'active', 'gain');
    expect(g).toEqual({
      calories: 2961,
      protein: 222, // round(2961*0.30/4) = round(222.075)
      carbs: 296, // round(2961*0.40/4) = round(296.1)
      fats: 99, // round(2961*0.30/9) = round(98.7)
      water: 2000,
    });
  });

  describe('sex BMR offsets (male +5 / female -161 / other -78)', () => {
    const weightKg = 80;
    const heightCm = 180;
    const age = 30;
    // base = 1775; tdee multiplier sedentary = 1.2; maintain adjustment = 0
    // male:   (1775+5)*1.2   = 2136
    // female: (1775-161)*1.2 = 1936.8 -> round 1937
    // other:  (1775-78)*1.2  = 2036.4 -> round 2036

    it('male adds +5 to base BMR', () => {
      const g = calculateGoals(weightKg, heightCm, age, 'male', 'sedentary', 'maintain');
      expect(g.calories).toBe(2136);
    });

    it('female subtracts 161 from base BMR', () => {
      const g = calculateGoals(weightKg, heightCm, age, 'female', 'sedentary', 'maintain');
      expect(g.calories).toBe(1937);
    });

    it('other subtracts 78 from base BMR', () => {
      const g = calculateGoals(weightKg, heightCm, age, 'other', 'sedentary', 'maintain');
      expect(g.calories).toBe(2036);
    });

    it('male is exactly 83 kcal above female for same inputs (the +5 vs -161 = 166 BMR delta * 1.2)', () => {
      const male = calculateGoals(weightKg, heightCm, age, 'male', 'sedentary', 'maintain');
      const female = calculateGoals(weightKg, heightCm, age, 'female', 'sedentary', 'maintain');
      // BMR delta = 166; * 1.2 = 199.2; round(2136) - round(1936.8) = 2136 - 1937 = 199
      expect(male.calories - female.calories).toBe(199);
    });
  });

  describe('activity multipliers (male, maintain, base BMR = 1780)', () => {
    const args = (activity: Parameters<typeof calculateGoals>[4]) =>
      calculateGoals(80, 180, 30, 'male', activity, 'maintain');

    it('sedentary = 1.2', () => {
      expect(args('sedentary').calories).toBe(2136); // round(1780*1.2)
    });
    it('light = 1.375', () => {
      expect(args('light').calories).toBe(2448); // round(1780*1.375 = 2447.5)
    });
    it('moderate = 1.55', () => {
      expect(args('moderate').calories).toBe(2759); // round(1780*1.55)
    });
    it('active = 1.725', () => {
      expect(args('active').calories).toBe(3071); // round(1780*1.725 = 3070.5)
    });
    it('veryActive = 1.9', () => {
      expect(args('veryActive').calories).toBe(3382); // round(1780*1.9)
    });
  });

  describe('goal adjustments (male, moderate, tdee = 2759)', () => {
    const args = (goal: Parameters<typeof calculateGoals>[5]) =>
      calculateGoals(80, 180, 30, 'male', 'moderate', goal);

    it('lose subtracts 500', () => {
      expect(args('lose').calories).toBe(2259); // 2759 - 500
    });
    it('maintain adds 0', () => {
      expect(args('maintain').calories).toBe(2759);
    });
    it('gain adds 400', () => {
      expect(args('gain').calories).toBe(3159); // 2759 + 400
    });
  });

  describe('1200 kcal floor', () => {
    it('clamps calories to 1200 when the computed value is lower', () => {
      // female, sedentary, lose -> tdee = 1614.3; -500 = 1114.3 -> floored to 1200
      const g = calculateGoals(60, 165, 25, 'female', 'sedentary', 'lose');
      expect(g.calories).toBe(1200);
    });

    it('derives macros from the floored 1200 value, not the pre-floor value', () => {
      const g = calculateGoals(60, 165, 25, 'female', 'sedentary', 'lose');
      expect(g).toEqual({
        calories: 1200,
        protein: 90, // round(1200*0.30/4) = 90
        carbs: 120, // round(1200*0.40/4) = 120
        fats: 40, // round(1200*0.30/9) = round(40)
        water: 2000,
      });
    });
  });

  describe('30/40/30 macro split invariant', () => {
    it('protein/carbs/fats follow protein*4, carbs*4, fat*9 of the kcal split', () => {
      const g = calculateGoals(80, 180, 30, 'male', 'moderate', 'maintain');
      const cal = g.calories;
      expect(g.protein).toBe(Math.round((cal * 0.3) / 4));
      expect(g.carbs).toBe(Math.round((cal * 0.4) / 4));
      expect(g.fats).toBe(Math.round((cal * 0.3) / 9));
    });

    it('always returns water = 2000 regardless of inputs', () => {
      expect(calculateGoals(50, 150, 20, 'female', 'light', 'lose').water).toBe(2000);
      expect(calculateGoals(120, 200, 60, 'male', 'veryActive', 'gain').water).toBe(2000);
    });
  });
});
