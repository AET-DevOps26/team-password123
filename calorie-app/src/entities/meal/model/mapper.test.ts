import { describe, it, expect } from 'vitest';
import {
  mealResponseToEntry,
  entryToManualRequest,
  singleItemFromMacros,
  foodEstimateResponseToEstimate,
  SLOT_TO_MEAL_TYPE,
} from './mapper';
import type { MealResponse, MealItemRequest, FoodEstimateResponse } from '../api/backendTypes';

// Slot tones are private to the mapper; we assert the exact values it emits.
const TONE = {
  Breakfast: '#e8d9c4',
  Lunch: '#cfe0c9',
  Dinner: '#d4d9e8',
  Snack: '#e4d2cf',
} as const;

function makeResponse(overrides: Partial<MealResponse> = {}): MealResponse {
  return {
    id: 'meal-1',
    mealType: 'BREAKFAST',
    // Local-time string (no offset) so getHours/getMinutes are timezone-stable.
    loggedAt: '2026-05-29T08:05:00',
    sourceType: 'MANUAL',
    calories: 500,
    proteinGrams: 30,
    carbsGrams: 60,
    fatGrams: 20,
    fiberGrams: 5,
    notes: null,
    photoUrl: null,
    items: [],
    ...overrides,
  };
}

describe('mealResponseToEntry', () => {
  it('maps every field, slot, time and tone for a typical response', () => {
    const r = makeResponse({
      id: 'abc',
      mealType: 'LUNCH',
      loggedAt: '2026-05-29T13:07:00',
      notes: 'Chicken salad',
      calories: 540,
      proteinGrams: 42,
      carbsGrams: 38,
      fatGrams: 19,
    });

    expect(mealResponseToEntry(r)).toEqual({
      id: 'abc',
      slot: 'Lunch',
      time: '13:07',
      name: 'Chicken salad',
      calories: 540,
      protein: 42,
      carbs: 38,
      fat: 19,
      tone: TONE.Lunch,
    });
  });

  it('maps a linked photoUrl to imageUrl, and null to undefined', () => {
    const url = '/api/meals/photo/p-1/raw';
    expect(mealResponseToEntry(makeResponse({ photoUrl: url })).imageUrl).toBe(url);
    expect(mealResponseToEntry(makeResponse({ photoUrl: null })).imageUrl).toBeUndefined();
  });

  it('maps each backend mealType to the correct UI slot + tone', () => {
    const cases: Array<[MealResponse['mealType'], string, string]> = [
      ['BREAKFAST', 'Breakfast', TONE.Breakfast],
      ['LUNCH', 'Lunch', TONE.Lunch],
      ['DINNER', 'Dinner', TONE.Dinner],
      ['SNACK', 'Snack', TONE.Snack],
    ];
    for (const [mealType, slot, tone] of cases) {
      const e = mealResponseToEntry(makeResponse({ mealType }));
      expect(e.slot).toBe(slot);
      expect(e.tone).toBe(tone);
    }
  });

  it('falls back to slot "Lunch" for an unknown mealType', () => {
    // Force an out-of-vocabulary value to exercise the ?? 'Lunch' branch.
    const r = makeResponse({ mealType: 'BRUNCH' as unknown as MealResponse['mealType'] });
    const e = mealResponseToEntry(r);
    expect(e.slot).toBe('Lunch');
    expect(e.tone).toBe(TONE.Lunch);
  });

  it('zero-pads single-digit hours and minutes', () => {
    const e = mealResponseToEntry(makeResponse({ loggedAt: '2026-05-29T07:03:00' }));
    expect(e.time).toBe('07:03');
  });

  it('rounds all macro and calorie values', () => {
    const e = mealResponseToEntry(
      makeResponse({
        calories: 499.6,
        proteinGrams: 30.4,
        carbsGrams: 59.5,
        fatGrams: 19.49,
      }),
    );
    expect(e.calories).toBe(500); // round(499.6)
    expect(e.protein).toBe(30); // round(30.4)
    expect(e.carbs).toBe(60); // round(59.5)
    expect(e.fat).toBe(19); // round(19.49)
  });

  describe('name resolution priority', () => {
    it('prefers trimmed notes when present', () => {
      const e = mealResponseToEntry(
        makeResponse({
          notes: '  Oatmeal  ',
          items: [{ id: 'i1', name: 'Oats', quantity: 1, unit: 'cup', calories: 1, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0 }],
        }),
      );
      expect(e.name).toBe('Oatmeal');
    });

    it('falls back to the first item name when notes are blank', () => {
      const e = mealResponseToEntry(
        makeResponse({
          mealType: 'DINNER',
          notes: '   ',
          items: [{ id: 'i1', name: 'Pasta', quantity: 1, unit: 'plate', calories: 1, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0 }],
        }),
      );
      expect(e.name).toBe('Pasta');
    });

    it('falls back to the slot label when notes are null and there are no items', () => {
      const e = mealResponseToEntry(makeResponse({ mealType: 'SNACK', notes: null, items: [] }));
      expect(e.name).toBe('Snack');
    });
  });
});

describe('entryToManualRequest', () => {
  it('builds the request with the mapped mealType, ISO loggedAt, notes and items', () => {
    const loggedAt = new Date('2026-05-29T13:07:00.000Z');
    const items: MealItemRequest[] = [
      {
        name: 'Rice',
        quantity: 2,
        unit: 'cup',
        calories: 400,
        proteinGrams: 8,
        carbsGrams: 90,
        fatGrams: 1,
        fiberGrams: 2,
      },
    ];

    const req = entryToManualRequest('Dinner', 'My dinner', loggedAt, items);

    expect(req).toEqual({
      mealType: 'DINNER',
      loggedAt: '2026-05-29T13:07:00.000Z',
      notes: 'My dinner',
      items,
    });
  });

  it('uses SLOT_TO_MEAL_TYPE for every slot', () => {
    const loggedAt = new Date('2026-05-29T00:00:00.000Z');
    (['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const).forEach((slot) => {
      const req = entryToManualRequest(slot, 'x', loggedAt, []);
      expect(req.mealType).toBe(SLOT_TO_MEAL_TYPE[slot]);
    });
  });

  it('passes the items array through by reference', () => {
    const items: MealItemRequest[] = [];
    const req = entryToManualRequest('Breakfast', 'n', new Date('2026-05-29T00:00:00.000Z'), items);
    expect(req.items).toBe(items);
  });
});

describe('foodEstimateResponseToEstimate', () => {
  it('maps snake_case genai wire format (current meals-service passthrough)', () => {
    const raw: FoodEstimateResponse = {
      food_name: 'toast',
      calories_per_100g: 279,
      protein_grams_per_100g: 9,
      carbs_grams_per_100g: 53,
      fat_grams_per_100g: 3.5,
      typical_portion_grams: 30,
      typical_portion_label: '1 slice',
      source: 'local',
      confidence: 0.9,
    };

    expect(foodEstimateResponseToEstimate(raw)).toEqual({
      foodName: 'toast',
      caloriesPer100g: 279,
      proteinPer100g: 9,
      carbsPer100g: 53,
      fatPer100g: 3.5,
      typicalPortionGrams: 30,
      typicalPortionLabel: '1 slice',
      source: 'local',
      confidence: 0.9,
    });
  });

  it('maps camelCase when meals-service maps the response', () => {
    const raw: FoodEstimateResponse = {
      foodName: 'toast',
      caloriesPer100g: 279,
      proteinPer100g: 9,
      carbsPer100g: 53,
      fatPer100g: 3.5,
      typicalPortionGrams: 30,
      typicalPortionLabel: '1 slice',
      source: 'local',
      confidence: 0.9,
    };

    expect(foodEstimateResponseToEstimate(raw).foodName).toBe('toast');
    expect(foodEstimateResponseToEstimate(raw).typicalPortionGrams).toBe(30);
  });
});

describe('singleItemFromMacros', () => {
  it('creates a synthetic single-serving item with fiber forced to 0', () => {
    expect(singleItemFromMacros('Burger', 700, 35, 50, 38)).toEqual({
      name: 'Burger',
      quantity: 1,
      unit: 'serving',
      calories: 700,
      proteinGrams: 35,
      carbsGrams: 50,
      fatGrams: 38,
      fiberGrams: 0,
    });
  });

  it('does not round or transform the provided macro values', () => {
    const item = singleItemFromMacros('X', 123.4, 5.5, 6.6, 7.7);
    expect(item.calories).toBe(123.4);
    expect(item.proteinGrams).toBe(5.5);
    expect(item.carbsGrams).toBe(6.6);
    expect(item.fatGrams).toBe(7.7);
  });
});
