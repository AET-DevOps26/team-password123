import { describe, it, expect } from 'vitest';
import { scaleEstimate } from './scaleEstimate';
import type { FoodEstimate } from '../model/types';

const toast: FoodEstimate = {
  foodName: 'Toast',
  caloriesPer100g: 265,
  proteinPer100g: 9,
  carbsPer100g: 49,
  fatPer100g: 3.2,
  typicalPortionGrams: 30,
  typicalPortionLabel: '1 slice',
  source: 'curated',
  confidence: 0.9,
};

describe('scaleEstimate', () => {
  it('returns the per-100g values unchanged for a 100 g portion', () => {
    expect(scaleEstimate(toast, 100)).toEqual({
      calories: 265,
      proteinGrams: 9,
      carbsGrams: 49,
      fatGrams: 3.2,
    });
  });

  it('scales a 30 g slice (kcal rounded to int, macros to 0.1)', () => {
    // factor 0.3: 265*.3=79.5->80, 9*.3=2.7, 49*.3=14.7, 3.2*.3=0.96->1.0
    expect(scaleEstimate(toast, 30)).toEqual({
      calories: 80,
      proteinGrams: 2.7,
      carbsGrams: 14.7,
      fatGrams: 1,
    });
  });

  it('returns zeros for a zero-gram portion', () => {
    expect(scaleEstimate(toast, 0)).toEqual({
      calories: 0,
      proteinGrams: 0,
      carbsGrams: 0,
      fatGrams: 0,
    });
  });
});
