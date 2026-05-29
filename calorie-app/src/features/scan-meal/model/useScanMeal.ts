import { useState, useRef } from 'react';
import { mealApi, useMealStore } from '../../../entities/meal';
import type { Meal, MealEntry } from '../../../entities/meal';

export type ScanStage = 'idle' | 'scanning' | 'result' | 'error';

export type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export interface ScanState {
  stage: ScanStage;
  file: File | null;
  previewUrl: string | null;
  result: Meal | null;
  errorMessage: string | null;
  slot: MealSlot;
}

export interface ScanActions {
  setFile: (file: File) => void;
  clearFile: () => void;
  analyze: () => Promise<void>;
  setSlot: (slot: MealSlot) => void;
  addToDiary: () => void;
  retry: () => void;
}

const PROGRESS_TICK_MS = 180;
const PROGRESS_STEP_MIN = 3;
const PROGRESS_STEP_MAX = 12;

export function useScanMeal(): ScanState & ScanActions {
  const [stage, setStage] = useState<ScanStage>('idle');
  const [file, setFileState] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<Meal | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [slot, setSlot] = useState<MealSlot>('Lunch');

  const addEntry = useMealStore((s) => s.addEntry);

  // Hold API result while progress animation finishes
  const pendingResult = useRef<Meal | null>(null);
  const progressDone = useRef(false);
  const apiDone = useRef(false);

  function advanceIfBothDone() {
    if (progressDone.current && apiDone.current) {
      if (pendingResult.current) {
        setResult(pendingResult.current);
        setStage('result');
      }
    }
  }

  function setFile(f: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(f);
    setFileState(f);
    setPreviewUrl(url);
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
    pendingResult.current = null;
    progressDone.current = false;
    apiDone.current = false;

    // Progress animation: tick every 180ms, random 3-12% per tick
    // signals done via ref when it reaches 100%
    let pct = 6;
    const interval = setInterval(() => {
      pct += PROGRESS_STEP_MIN + Math.random() * (PROGRESS_STEP_MAX - PROGRESS_STEP_MIN);
      if (pct >= 100) {
        pct = 100;
        clearInterval(interval);
        setTimeout(() => {
          progressDone.current = true;
          advanceIfBothDone();
        }, 520); // brief pause at 100%
      }
    }, PROGRESS_TICK_MS);

    // Real API call in parallel
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
  }

  function addToDiary() {
    if (!result) return;
    const now = new Date();
    const time = now.toTimeString().slice(0, 5);

    const entry: MealEntry = {
      id: `scan-${Date.now()}`,
      slot,
      time,
      name: result.dishName,
      calories: result.nutrition.calories,
      protein: result.nutrition.protein,
      carbs: result.nutrition.carbs,
      fat: result.nutrition.fat,
      tone: SLOT_TONES[slot],
    };

    addEntry(entry);
  }

  function retry() {
    setStage('idle');
    setErrorMessage(null);
    pendingResult.current = null;
    progressDone.current = false;
    apiDone.current = false;
  }

  return {
    stage, file, previewUrl, result, errorMessage, slot,
    setFile, clearFile, analyze, setSlot, addToDiary, retry,
  };
}

const SLOT_TONES: Record<MealSlot, string> = {
  Breakfast: '#e8d9c4',
  Lunch:     '#cfe0c9',
  Dinner:    '#d4d9e8',
  Snack:     '#e4d2cf',
};
