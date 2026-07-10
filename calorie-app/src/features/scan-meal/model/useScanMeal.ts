import { useMemo, useState } from 'react';
import { mealApi, useMealStore } from '../../../entities/meal';
import { mealResponseToEntry, entryToManualRequest, singleItemFromMacros } from '../../../entities/meal/model/mapper';
import { scaleMealNutrition } from '../../../entities/meal/lib/scaleEstimate';
import { isPersistedMealId } from '../../meal-detail/model/useMealDetail';
import type { Meal, MealEntry } from '../../../entities/meal';
import type { NutritionInfo } from '../../../entities/nutrition';
import type { PhotoLogResponse } from '../../../entities/meal/api/backendTypes';

export type ScanStage = 'idle' | 'scanning' | 'result' | 'manual_required' | 'error';

export type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export type VisionProvider = 'auto' | 'gemini' | 'nemotron';

export interface ManualForm {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

export interface ScanState {
  stage: ScanStage;
  file: File | null;
  previewUrl: string | null;
  result: Meal | null;
  photoLog: PhotoLogResponse | null;
  manualForm: ManualForm;
  errorMessage: string | null;
  slot: MealSlot;
  visionProvider: VisionProvider;
  portionGrams: number;
  scaledNutrition: NutritionInfo | null;
}

export interface ScanActions {
  setFile: (file: File) => void;
  clearFile: () => void;
  analyze: () => Promise<void>;
  setSlot: (slot: MealSlot) => void;
  setVisionProvider: (provider: VisionProvider) => void;
  setPortionGrams: (grams: number) => void;
  patchManualForm: (patch: Partial<ManualForm>) => void;
  addToDiary: () => Promise<void>;
  retry: () => void;
}

const SLOT_TONES: Record<MealSlot, string> = {
  Breakfast: '#e8d9c4',
  Lunch:     '#cfe0c9',
  Dinner:    '#d4d9e8',
  Snack:     '#e4d2cf',
};

const EMPTY_FORM: ManualForm = { name: '', calories: '', protein: '', carbs: '', fat: '' };
const DEFAULT_PORTION_GRAMS = 250;

function clampPortionGrams(grams: number): number {
  return Math.min(9999, Math.max(1, Math.round(grams)));
}

function initialPortionGrams(meal: Meal): number {
  const grams = meal.portionGrams ?? 0;
  return grams > 0 ? clampPortionGrams(grams) : DEFAULT_PORTION_GRAMS;
}

/** Read a File into a data: URL so the scanned photo renders instantly in the diary. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function useScanMeal(): ScanState & ScanActions {
  const [stage,       setStage]       = useState<ScanStage>('idle');
  const [file,        setFileState]   = useState<File | null>(null);
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  const [result,      setResult]      = useState<Meal | null>(null);
  const [photoLog,    setPhotoLog]    = useState<PhotoLogResponse | null>(null);
  const [manualForm,  setManualForm]  = useState<ManualForm>(EMPTY_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [slot,        setSlot]        = useState<MealSlot>('Lunch');
  const [visionProvider, setVisionProvider] = useState<VisionProvider>('auto');
  const [basePortionGrams, setBasePortionGrams] = useState(DEFAULT_PORTION_GRAMS);
  const [portionGrams, setPortionGramsState] = useState(DEFAULT_PORTION_GRAMS);

  const addEntry = useMealStore((s) => s.addEntry);

  const scaledNutrition = useMemo(() => {
    if (!result) return null;
    return scaleMealNutrition(result.nutrition, basePortionGrams, portionGrams);
  }, [result, basePortionGrams, portionGrams]);

  function setFile(f: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFileState(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResult(null);
  }

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFileState(null);
    setPreviewUrl(null);
    setResult(null);
  }

  function setPortionGrams(grams: number) {
    setPortionGramsState(clampPortionGrams(grams));
  }

  async function analyze() {
    if (!file) return;
    setStage('scanning');
    setErrorMessage(null);

    try {
      const response = await mealApi.analyzePhoto(file, visionProvider);
      if (response?.meal) {
        const grams = initialPortionGrams(response.meal);
        setBasePortionGrams(grams);
        setPortionGramsState(grams);
        setResult(response.meal);
        setStage('result');
      } else {
        setErrorMessage('Scan returned no meal data. Try again or enter details manually.');
        fallbackToManual(file);
      }
    } catch (err) {
      const status = (err as { status?: number }).status;
      const msg = (err as { message?: string }).message ?? 'Scan failed';
      if (status === 403 || status === 401) {
        setErrorMessage('Session expired or invalid — log out and log in again, then retry.');
      } else {
        setErrorMessage(msg);
      }
      fallbackToManual(file);
    }
  }

  function fallbackToManual(f: File) {
    const nameHint = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    setManualForm({ ...EMPTY_FORM, name: nameHint });
    setStage('manual_required');
  }

  function patchManualForm(patch: Partial<ManualForm>) {
    setManualForm((f) => ({ ...f, ...patch }));
  }

  async function addToDiary() {
    const now  = new Date();
    const time = now.toTimeString().slice(0, 5);
    const imageUrl = file ? await fileToDataUrl(file).catch(() => undefined) : undefined;

    if (result && scaledNutrition) {
      const mealId = String(result.id);
      const item = {
        ...singleItemFromMacros(
          result.dishName,
          scaledNutrition.calories,
          scaledNutrition.protein,
          scaledNutrition.carbs,
          scaledNutrition.fat,
        ),
        quantity: portionGrams,
        unit: 'g',
      };
      const request = entryToManualRequest(slot, result.dishName, now, [item]);

      if (isPersistedMealId(mealId)) {
        try {
          await mealApi.update(mealId, request);
        } catch {
          // Still add locally if the portion update fails.
        }
      }

      const entry: MealEntry = {
        id:       isPersistedMealId(mealId) ? mealId : `scan-${Date.now()}`,
        slot,
        time,
        name:     result.dishName,
        calories: scaledNutrition.calories,
        protein:  scaledNutrition.protein,
        carbs:    scaledNutrition.carbs,
        fat:      scaledNutrition.fat,
        tone:     SLOT_TONES[slot],
        imageUrl: result.imageUrl || imageUrl,
      };
      addEntry(entry);
      return;
    }

    const cal  = parseInt(manualForm.calories, 10) || 0;
    const prot = parseInt(manualForm.protein,  10) || 0;
    const carb = parseInt(manualForm.carbs,    10) || 0;
    const fat  = parseInt(manualForm.fat,      10) || 0;
    const name = manualForm.name.trim() || slot;

    const item = singleItemFromMacros(name, cal, prot, carb, fat);
    const request = entryToManualRequest(slot, name, now, [item]);

    try {
      const response = photoLog?.id
        ? await mealApi.convertPhotoToMeal(photoLog.id, request)
        : await mealApi.saveManual(request);

      if (response) {
        addEntry({ ...mealResponseToEntry(response), imageUrl });
      }
    } catch {
      addEntry({ id: `scan-${Date.now()}`, slot, time, name, calories: cal, protein: prot, carbs: carb, fat, tone: SLOT_TONES[slot], imageUrl });
    }
  }

  function retry() {
    setStage('idle');
    setErrorMessage(null);
    setPhotoLog(null);
    setManualForm(EMPTY_FORM);
    setResult(null);
  }

  return {
    stage, file, previewUrl, result, photoLog, manualForm, errorMessage, slot,
    visionProvider, portionGrams, scaledNutrition,
    setFile, clearFile, analyze, setSlot, setVisionProvider, setPortionGrams, patchManualForm, addToDiary, retry,
  };
}
