import { useEffect, useState } from 'react';
import { mealApi } from '../../../entities/meal/api/mealApi';
import { useMealStore } from '../../../entities/meal/model/store';
import type { MealEntry, MealSlot } from '../../../entities/meal';
import {
  entryToManualRequest,
  mealResponseToEntry,
  singleItemFromMacros,
} from '../../../entities/meal/model/mapper';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPersistedMealId(id: string): boolean {
  return UUID_RE.test(id);
}

export function useMealDetail(meal: MealEntry) {
  const updateEntry = useMealStore((s) => s.updateEntry);
  const removeEntry = useMealStore((s) => s.removeEntry);

  const [name, setName]         = useState(meal.name);
  const [slot, setSlot]         = useState<MealSlot>(meal.slot);
  const [calories, setCalories] = useState(String(meal.calories));
  const [protein, setProtein]   = useState(String(meal.protein));
  const [carbs, setCarbs]       = useState(String(meal.carbs));
  const [fat, setFat]           = useState(String(meal.fat));
  const [loggedAt, setLoggedAt] = useState<string | null>(null);
  const [loading, setLoading]   = useState(isPersistedMealId(meal.id));
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const persisted = isPersistedMealId(meal.id);

  useEffect(() => {
    if (!persisted) return;

    let active = true;
    mealApi.getById(meal.id)
      .then((response) => {
        if (!active) return;
        const entry = mealResponseToEntry(response);
        setName(entry.name);
        setSlot(entry.slot);
        setCalories(String(entry.calories));
        setProtein(String(entry.protein));
        setCarbs(String(entry.carbs));
        setFat(String(entry.fat));
        setLoggedAt(response.loggedAt);
      })
      .catch(() => {
        if (active) setError('Could not load meal details.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [meal.id, persisted]);

  const calNum  = parseInt(calories, 10) || 0;
  const protNum = parseInt(protein, 10) || 0;
  const carbNum = parseInt(carbs, 10) || 0;
  const fatNum  = parseInt(fat, 10) || 0;

  const canSave =
    name.trim().length > 0 &&
    calNum > 0 &&
    !saving &&
    !deleting &&
    !loading;

  async function save(): Promise<boolean> {
    setError(null);
    setSaving(true);

    const trimmedName = name.trim();
    const item = singleItemFromMacros(trimmedName, calNum, protNum, carbNum, fatNum);
    const when = loggedAt ? new Date(loggedAt) : new Date();
    const request = entryToManualRequest(slot, trimmedName, when, [item]);

    try {
      if (persisted) {
        const response = await mealApi.update(meal.id, request);
        const updated = { ...mealResponseToEntry(response), imageUrl: meal.imageUrl ?? mealResponseToEntry(response).imageUrl };
        updateEntry(updated);
      } else {
        updateEntry({
          ...meal,
          name: trimmedName,
          slot,
          calories: calNum,
          protein: protNum,
          carbs: carbNum,
          fat: fatNum,
        });
      }
      return true;
    } catch (err) {
      const msg = (err as { message?: string }).message ?? 'Could not save changes.';
      setError(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function remove(): Promise<boolean> {
    setError(null);
    setDeleting(true);

    try {
      if (persisted) {
        await mealApi.delete(meal.id);
      }
      removeEntry(meal.id);
      return true;
    } catch (err) {
      const msg = (err as { message?: string }).message ?? 'Could not delete this meal.';
      setError(msg);
      return false;
    } finally {
      setDeleting(false);
    }
  }

  return {
    name, setName,
    slot, setSlot,
    calories, setCalories,
    protein, setProtein,
    carbs, setCarbs,
    fat, setFat,
    loading,
    saving,
    deleting,
    error,
    persisted,
    canSave,
    save,
    remove,
  };
}
