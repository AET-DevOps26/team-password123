import { useState } from 'react';
import { mealApi, useMealStore } from '../../../entities/meal';
import { mealResponseToEntry, entryToManualRequest, singleItemFromMacros } from '../../../entities/meal/model/mapper';
import type { Meal, MealEntry } from '../../../entities/meal';
import type { PhotoLogResponse } from '../../../entities/meal/api/backendTypes';

export type ScanStage = 'idle' | 'scanning' | 'result' | 'manual_required' | 'error';

export type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

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
}

export interface ScanActions {
  setFile: (file: File) => void;
  clearFile: () => void;
  analyze: () => Promise<void>;
  setSlot: (slot: MealSlot) => void;
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

  const addEntry = useMealStore((s) => s.addEntry);

  function setFile(f: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFileState(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFileState(null);
    setPreviewUrl(null);
  }

  async function analyze() {
    if (!file) return;
    setStage('scanning');
    setErrorMessage(null);

    // Send the photo to the GenAI vision model.
    try {
      const response = await mealApi.analyzePhoto(file);
      if (response?.meal) {
        setResult(response.meal);
        setStage('result');
      } else {
        // No AI result — fall back to manual entry.
        fallbackToManual(file);
      }
    } catch {
      // AI unavailable (service down, quota exhausted, …) — degrade gracefully
      // to manual entry rather than dead-ending the user.
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
    // The user's own photo, as a data URL — shown immediately in the diary thumbnail.
    // A read failure is non-fatal: the photo is cosmetic and must never block logging.
    const imageUrl = file ? await fileToDataUrl(file).catch(() => undefined) : undefined;

    if (result) {
      // A `result` means the GenAI path already recognized and persisted the meal
      // via /meals/analyze. Just reflect it in the local store — no second save.
      const entry: MealEntry = {
        id:       `scan-${Date.now()}`,
        slot,
        time,
        name:     result.dishName,
        calories: result.nutrition.calories,
        protein:  result.nutrition.protein,
        carbs:    result.nutrition.carbs,
        fat:      result.nutrition.fat,
        tone:     SLOT_TONES[slot],
        imageUrl,
      };
      addEntry(entry);
      return;
    }

    // Real backend path — save via convert-manual or plain manual
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
        // Show the user's local photo instantly; on reload the same image is served
        // from the backend via the entry's mapped photoUrl.
        addEntry({ ...mealResponseToEntry(response), imageUrl });
      }
    } catch {
      // Save failed — still add locally so user doesn't lose the entry
      addEntry({ id: `scan-${Date.now()}`, slot, time, name, calories: cal, protein: prot, carbs: carb, fat, tone: SLOT_TONES[slot], imageUrl });
    }
  }

  function retry() {
    setStage('idle');
    setErrorMessage(null);
    setPhotoLog(null);
    setManualForm(EMPTY_FORM);
  }

  return {
    stage, file, previewUrl, result, photoLog, manualForm, errorMessage, slot,
    setFile, clearFile, analyze, setSlot, patchManualForm, addToDiary, retry,
  };
}
