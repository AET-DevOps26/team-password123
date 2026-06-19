import { useState } from 'react';
import { useMealStore } from '../../../entities/meal';
import { mealApi } from '../../../entities/meal/api/mealApi';
import { mealResponseToEntry, entryToManualRequest } from '../../../entities/meal/model/mapper';

export type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

interface Ingredient {
  name: string;
  amount: string;
  calories: number;
}

const SUGGESTIONS: Ingredient[] = [
  { name: 'Banana',         amount: '1 medium', calories: 105 },
  { name: 'Peanut butter',  amount: '1 tbsp',   calories: 94  },
  { name: 'Oats',           amount: '40 g',      calories: 150 },
  { name: 'Whole milk',     amount: '250 ml',    calories: 153 },
  { name: 'Chicken breast', amount: '100 g',     calories: 165 },
  { name: 'Brown rice',     amount: '100 g',     calories: 216 },
  { name: 'Olive oil',      amount: '1 tbsp',    calories: 119 },
  { name: 'Egg',            amount: '1 large',   calories: 78  },
];

export function useManualEntry(defaultSlot: MealSlot = 'Lunch', loggedAt?: Date) {
  const [query, setQuery]   = useState('');
  const [items, setItems]   = useState<Ingredient[]>([]);
  const [slot, setSlot]     = useState<MealSlot>(defaultSlot);
  const [saving, setSaving] = useState(false);

  const addEntry = useMealStore((s) => s.addEntry);

  const suggestions = query.trim()
    ? SUGGESTIONS.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  const totalCalories = items.reduce((sum, i) => sum + i.calories, 0);

  function addIngredient(ingredient: Ingredient) {
    setItems((prev) => [...prev, ingredient]);
    setQuery('');
  }

  function removeIngredient(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function save(): Promise<number> {
    const now  = new Date();
    const savedAt = loggedAt ? new Date(loggedAt) : now;
    if (loggedAt) {
      savedAt.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    }
    const name = items.length === 1
      ? items[0].name
      : `${items[0]?.name ?? 'Mixed meal'} & more`;

    setSaving(true);
    try {
      const itemRequests = items.map((ing) => ({
        name:         ing.name,
        quantity:     1,
        unit:         ing.amount,
        calories:     ing.calories,
        // No per-ingredient macro data from the suggestions list → rough split
        proteinGrams: Math.round(ing.calories * 0.05),
        carbsGrams:   Math.round(ing.calories * 0.125),
        fatGrams:     Math.round(ing.calories * 0.033),
        fiberGrams:   0,
      }));

      const request = entryToManualRequest(slot, name, savedAt, itemRequests);
      const response = await mealApi.saveManual(request);
      if (response) addEntry(mealResponseToEntry(response));
    } finally {
      setSaving(false);
    }
    return totalCalories;
  }

  return {
    query, setQuery,
    items, addIngredient, removeIngredient,
    suggestions,
    totalCalories,
    slot, setSlot,
    save,
    saving,
    canSave: items.length > 0,
  };
}
