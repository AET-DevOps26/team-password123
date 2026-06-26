import { useRef, useState } from 'react';
import { useMealStore } from '../../../entities/meal';
import type { MealSlot, FoodEstimate } from '../../../entities/meal';
import { mealApi } from '../../../entities/meal/api/mealApi';
import {
  mealResponseToEntry,
  entryToManualRequest,
  foodEstimateResponseToEstimate,
} from '../../../entities/meal/model/mapper';
import { scaleEstimate } from '../../../entities/meal/lib/scaleEstimate';
import { fileToDataUrl } from '../../../shared/lib/fileToDataUrl';

export type { MealSlot };

interface Ingredient {
  name: string;
  amount: string;
  calories: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [aiEstimate, setAiEstimate] = useState<FoodEstimate | null>(null);
  const [portionGrams, setPortionGrams] = useState<number>(100);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  // Mirror of `query` readable inside async callbacks for the staleness guard.
  const queryRef = useRef('');

  const addEntry = useMealStore((s) => s.addEntry);

  const suggestions = query.trim()
    ? SUGGESTIONS.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  function resetEstimate() {
    setAiEstimate(null);
    setEstimateError(null);
    setPortionGrams(100);
  }

  // Editing the search box invalidates any stale AI estimate.
  function changeQuery(value: string) {
    queryRef.current = value;
    setQuery(value);
    resetEstimate();
  }

  async function estimateFood() {
    const q = query.trim();
    if (!q) return;
    setEstimating(true);
    setAiEstimate(null);
    setEstimateError(null);
    try {
      const response = await mealApi.estimateFood(q);
      if (queryRef.current.trim() !== q) return; // query changed mid-flight — ignore
      const estimate = foodEstimateResponseToEstimate(response);
      setAiEstimate(estimate);
      setPortionGrams(estimate.typicalPortionGrams);
    } catch {
      if (queryRef.current.trim() !== q) return;
      setEstimateError('Could not estimate — try a different name or add manually.');
    } finally {
      setEstimating(false);
    }
  }

  const totalCalories = items.reduce((sum, i) => sum + i.calories, 0);

  function addIngredient(ingredient: Ingredient) {
    setItems((prev) => [...prev, ingredient]);
    queryRef.current = '';
    setQuery('');
    resetEstimate();
  }

  function addAiEstimate() {
    if (!aiEstimate) return;
    const scaled = scaleEstimate(aiEstimate, portionGrams);
    addIngredient({
      name: aiEstimate.foodName,
      amount: `${portionGrams} g`,
      ...scaled,
    });
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

    // The user's own photo as a data URL — shown instantly in the diary thumbnail;
    // on reload the same image is served from the backend via the mapped photoUrl.
    const imageUrl = photoFile ? await fileToDataUrl(photoFile).catch(() => undefined) : undefined;

    setSaving(true);
    try {
      const itemRequests = items.map((ing) => ({
        name:         ing.name,
        quantity:     1,
        unit:         ing.amount,
        calories:     ing.calories,
        // Use AI-provided macros when available; fall back to rough estimate otherwise
        proteinGrams: ing.proteinGrams ?? Math.round(ing.calories * 0.05),
        carbsGrams:   ing.carbsGrams   ?? Math.round(ing.calories * 0.125),
        fatGrams:     ing.fatGrams     ?? Math.round(ing.calories * 0.033),
        fiberGrams:   0,
      }));

      const request = entryToManualRequest(slot, name, savedAt, itemRequests);

      // With a photo: upload it, then link the nutrition via convert-manual so the
      // photo persists. Without one: a plain manual save.
      let response = null;
      if (photoFile) {
        const photo = await mealApi.uploadPhoto(photoFile).catch(() => null);
        response = photo?.id
          ? await mealApi.convertPhotoToMeal(photo.id, request)
          : await mealApi.saveManual(request);
      } else {
        response = await mealApi.saveManual(request);
      }

      if (response) {
        addEntry({ ...mealResponseToEntry(response), imageUrl });
      } else if (import.meta.env.DEV) {
        // A 2xx with no body shouldn't happen for this endpoint — flag it in dev
        // so a silently dropped entry is noticeable. (Network/5xx errors throw
        // and propagate to the caller.)
        console.warn('POST /meals/manual returned no body — entry not added');
      }
    } finally {
      setSaving(false);
    }
    return totalCalories;
  }

  return {
    query, setQuery: changeQuery,
    items, addIngredient, removeIngredient,
    suggestions,
    totalCalories,
    slot, setSlot,
    photoFile,
    setPhoto: setPhotoFile,
    clearPhoto: () => setPhotoFile(null),
    save,
    saving,
    canSave: items.length > 0,
    estimateFood,
    estimating,
    aiEstimate,
    portionGrams, setPortionGrams,
    addAiEstimate,
    estimateError,
  };
}
