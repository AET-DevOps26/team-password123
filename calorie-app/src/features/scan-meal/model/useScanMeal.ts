import { useState, useRef } from 'react';
import { mealApi, useMealStore } from '../../../entities/meal';
import { mealResponseToEntry, entryToManualRequest, singleItemFromMacros } from '../../../entities/meal/model/mapper';
import type { Meal, MealEntry } from '../../../entities/meal';
import type { PhotoLogResponse } from '../../../entities/meal/api/backendTypes';
import { fileToDataUrl } from '../../../shared/lib/fileToDataUrl';
import { MOCK_MODE } from '../../../shared/config/flags';

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

const PROGRESS_TICK_MS  = 180;
const PROGRESS_STEP_MIN = 3;
const PROGRESS_STEP_MAX = 12;

const SLOT_TONES: Record<MealSlot, string> = {
  Breakfast: '#e8d9c4',
  Lunch:     '#cfe0c9',
  Dinner:    '#d4d9e8',
  Snack:     '#e4d2cf',
};

const EMPTY_FORM: ManualForm = { name: '', calories: '', protein: '', carbs: '', fat: '' };

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

  // Progress-animation sync refs (used only in MOCK_MODE / deprecated analyze path)
  const pendingResult = useRef<Meal | null>(null);
  const progressDone  = useRef(false);
  const apiDone       = useRef(false);

  function advanceIfBothDone() {
    if (progressDone.current && apiDone.current && pendingResult.current) {
      setResult(pendingResult.current);
      setStage('result');
    }
  }

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
    pendingResult.current  = null;
    progressDone.current   = false;
    apiDone.current        = false;

    if (MOCK_MODE) {
      // Legacy path: call deprecated /meals/analyze with progress animation
      let pct = 6;
      const interval = setInterval(() => {
        pct += PROGRESS_STEP_MIN + Math.random() * (PROGRESS_STEP_MAX - PROGRESS_STEP_MIN);
        if (pct >= 100) {
          pct = 100;
          clearInterval(interval);
          setTimeout(() => { progressDone.current = true; advanceIfBothDone(); }, 520);
        }
      }, PROGRESS_TICK_MS);

      try {
        const response = await mealApi.analyzePhoto(file);
        pendingResult.current = response.meal;
        apiDone.current = true;
        advanceIfBothDone();
      } catch (err) {
        clearInterval(interval);
        const msg = (err as { message?: string }).message ?? 'Failed to analyse the photo. Please try again.';
        setErrorMessage(msg);
        setStage('error');
      }
      return;
    }

    // Real backend path: send the photo to the GenAI vision model.
    try {
      const response = await mealApi.analyzePhoto(file);
      if (response?.meal) {
        setResult(response.meal);
        setStage('result');
      } else {
        // OFFLINE_MODE (no AI result) — fall back to manual entry.
        await fallbackToManual(file);
      }
    } catch {
      // AI unavailable (service down, quota exhausted, …) — degrade gracefully
      // to manual entry rather than dead-ending the user.
      await fallbackToManual(file);
    }
  }

  async function fallbackToManual(f: File) {
    const nameHint = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    setManualForm({ ...EMPTY_FORM, name: nameHint });
    setStage('manual_required');
    // Persist the captured photo now so addToDiary links it via convert-manual
    // and it survives a reload. Non-fatal: on failure the meal still saves
    // (without a linked photo) through the plain-manual path.
    try {
      const photo = await mealApi.uploadPhoto(f);
      if (photo) setPhotoLog(photo);
    } catch {
      // upload failed — leave photoLog null; the meal saves photo-less
    }
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
      // A `result` means the meal is already recognized: the MOCK path produced it
      // locally, and the real GenAI path already persisted it via /meals/analyze.
      // Either way, just reflect it in the local store — no second save.
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
      let response = null;
      if (photoLog?.id && photoLog.id !== 'offline-photo') {
        response = await mealApi.convertPhotoToMeal(photoLog.id, request);
      } else {
        response = await mealApi.saveManual(request);
      }

      if (response) {
        // Show the user's local photo instantly; on reload the same image is served
        // from the backend via the entry's mapped photoUrl.
        addEntry({ ...mealResponseToEntry(response), imageUrl });
      } else {
        // OFFLINE_MODE
        addEntry({ id: `scan-${Date.now()}`, slot, time, name, calories: cal, protein: prot, carbs: carb, fat, tone: SLOT_TONES[slot], imageUrl });
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
    pendingResult.current = null;
    progressDone.current  = false;
    apiDone.current       = false;
  }

  return {
    stage, file, previewUrl, result, photoLog, manualForm, errorMessage, slot,
    setFile, clearFile, analyze, setSlot, patchManualForm, addToDiary, retry,
  };
}
