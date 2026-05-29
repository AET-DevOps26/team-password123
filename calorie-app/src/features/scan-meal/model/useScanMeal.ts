import { useState, useRef } from 'react';
import { mealApi, useMealStore } from '../../../entities/meal';
import { mealResponseToEntry, entryToManualRequest, singleItemFromMacros } from '../../../entities/meal/model/mapper';
import type { Meal, MealEntry } from '../../../entities/meal';
import type { PhotoLogResponse } from '../../../entities/meal/api/backendTypes';
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

    // Real backend path: upload photo, then handle AI status
    try {
      const log = await mealApi.uploadPhoto(file);
      setPhotoLog(log);

      if (log.status === 'AI_NOT_AVAILABLE') {
        // Pre-fill form name from file name (best-effort)
        const nameHint = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        setManualForm({ ...EMPTY_FORM, name: nameHint });
        setStage('manual_required');
      } else {
        // AI completed (future capability) — treat as manual_required for now
        setManualForm(EMPTY_FORM);
        setStage('manual_required');
      }
    } catch (err) {
      const msg = (err as { message?: string }).message ?? 'Failed to upload the photo. Please try again.';
      setErrorMessage(msg);
      setStage('error');
    }
  }

  function patchManualForm(patch: Partial<ManualForm>) {
    setManualForm((f) => ({ ...f, ...patch }));
  }

  async function addToDiary() {
    const now  = new Date();
    const time = now.toTimeString().slice(0, 5);

    if (MOCK_MODE && result) {
      // Legacy MOCK_MODE path
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
        addEntry(mealResponseToEntry(response));
      } else {
        // OFFLINE_MODE
        addEntry({ id: `scan-${Date.now()}`, slot, time, name, calories: cal, protein: prot, carbs: carb, fat, tone: SLOT_TONES[slot] });
      }
    } catch {
      // Save failed — still add locally so user doesn't lose the entry
      addEntry({ id: `scan-${Date.now()}`, slot, time, name, calories: cal, protein: prot, carbs: carb, fat, tone: SLOT_TONES[slot] });
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
