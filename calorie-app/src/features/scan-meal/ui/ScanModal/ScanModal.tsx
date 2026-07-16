import { useRef, useState, useEffect } from 'react';
import { Modal } from '../../../../shared/ui/Modal/Modal';
import { MacroBar } from '../../../../entities/nutrition';
import { FEATURES, useFeatureToggle, useFeatureToggleStore } from '../../../../entities/feature';
import { ScanProgress } from '../ScanProgress/ScanProgress';
import { useScanMeal } from '../../model/useScanMeal';
import type { MealSlot, VisionProvider } from '../../model/useScanMeal';
import styles from './ScanModal.module.css';

interface ScanModalProps {
  onClose: () => void;
  onAdded: (kcal: number) => void;
}

const TITLES: Record<string, string> = {
  idle:             'Scan a meal',
  scanning:         'Uploading…',
  result:           'Review & log',
  manual_required:  'Fill in details',
  error:            'Scan a meal',
};

const SLOTS: MealSlot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export function ScanModal({ onClose, onAdded }: ScanModalProps) {
  const scan = useScanMeal();
  const loadFeatureToggles = useFeatureToggleStore((s) => s.load);
  const visionPickerEnabled = useFeatureToggle(FEATURES.SCAN_VISION_MODEL_PICKER);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    void loadFeatureToggles();
  }, [loadFeatureToggles]);

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) return;
    scan.setFile(file);
  }

  async function handleAdd() {
    await scan.addToDiary();
    const kcal =
      scan.stage === 'result'
        ? (scan.scaledNutrition?.calories ?? 0)
        : parseInt(scan.manualForm.calories, 10) || 0;
    onAdded(kcal);
  }

  const manualFormValid =
    scan.manualForm.name.trim().length > 0 &&
    parseInt(scan.manualForm.calories, 10) > 0;

  const footer =
    scan.stage === 'result' ? (
      <>
        <select
          className={styles.slotSelect}
          value={scan.slot}
          onChange={(e) => scan.setSlot(e.target.value as MealSlot)}
        >
          {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className={`${styles.btn} ${styles.primary} ${styles.grow}`} onClick={handleAdd}>
          <CheckIcon /> Add {scan.scaledNutrition?.calories ?? scan.result?.nutrition.calories ?? 0} kcal to diary
        </button>
      </>
    ) : scan.stage === 'manual_required' ? (
      <>
        <select
          className={styles.slotSelect}
          value={scan.slot}
          onChange={(e) => scan.setSlot(e.target.value as MealSlot)}
        >
          {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          className={`${styles.btn} ${styles.primary} ${styles.grow}`}
          disabled={!manualFormValid}
          onClick={handleAdd}
        >
          <CheckIcon /> Log {parseInt(scan.manualForm.calories, 10) || 0} kcal
        </button>
      </>
    ) : undefined;

  return (
    <Modal title={TITLES[scan.stage]} onClose={onClose} footer={footer}>
      {/* ── Photo area ── */}
      <div className={styles.photo}>
        {scan.previewUrl ? (
          <img src={scan.previewUrl} alt="Meal" className={styles.photoImg} />
        ) : (
          <div
            className={`${styles.dropzone} ${isDragOver ? styles.dragOver : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
          >
            <CameraIcon />
            <span className={styles.dropHint}><strong>Click</strong> or drag a photo here</span>
            <span className={styles.dropSub}>JPG, PNG, WEBP — up to 10 MB</span>
          </div>
        )}

        {scan.stage === 'scanning' && (
          <div className={styles.scanVeil}>
            <div className={styles.scanLine} />
          </div>
        )}

        {scan.stage === 'result' && scan.result && (
          <div className={styles.resultTag}>
            <span className={styles.tagName}>{scan.result.dishName}</span>
            <span className={styles.tagMeta}>
              {Math.round(scan.result.confidence * 100)}% match
              {scan.result.visionModel ? ` · ${scan.result.visionModel}` : ''}
            </span>
          </div>
        )}

        {scan.stage === 'idle' && scan.previewUrl && (
          <button className={styles.retakeBtn} onClick={scan.clearFile}>
            <RetakeIcon /> Retake
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {/* ── Stage content ── */}

      {scan.stage === 'idle' && (
        <div className={styles.idleBody}>
          {visionPickerEnabled && (
            <VisionProviderPicker
              value={scan.visionProvider}
              onChange={scan.setVisionProvider}
            />
          )}
          <p className={styles.hint}>
            Snap your plate or upload a photo. Our model identifies each ingredient and
            estimates the nutrition — no manual searching.
          </p>
          <div className={styles.actions}>
            <button
              className={`${styles.btn} ${styles.primary} ${styles.block}`}
              disabled={!scan.file}
              onClick={scan.analyze}
            >
              <BoltIcon /> Analyze meal
            </button>
            {scan.file && (
              <button
                className={`${styles.btn} ${styles.ghost} ${styles.block}`}
                onClick={scan.clearFile}
              >
                Choose a different photo
              </button>
            )}
          </div>
        </div>
      )}

      {scan.stage === 'scanning' && (
        <ScanProgress onDone={() => { /* handled inside useScanMeal */ }} />
      )}

      {scan.stage === 'result' && scan.result && scan.scaledNutrition && (
        <div className={styles.result}>
          <div className={styles.resultSummary}>
            <div className={styles.kcalBlock}>
              <span className={styles.kcalNum}>{scan.scaledNutrition.calories}</span>
              <span className={styles.kcalLabel}>kcal</span>
            </div>
            <PortionControl
              grams={scan.portionGrams}
              onChange={scan.setPortionGrams}
            />
          </div>
          <div className={styles.macros}>
            <MacroBar label="Protein" value={scan.scaledNutrition.protein} goal={120} color="var(--protein)" />
            <MacroBar label="Carbs"   value={scan.scaledNutrition.carbs}   goal={220} color="var(--carbs)" />
            <MacroBar label="Fat"     value={scan.scaledNutrition.fat}     goal={65}  color="var(--fat)" />
          </div>
        </div>
      )}

      {scan.stage === 'manual_required' && (
        <div className={styles.idleBody}>
          {scan.errorMessage && (
            <p className={styles.errorMsg}>{scan.errorMessage}</p>
          )}
          <p className={styles.hint}>
            We couldn't read this photo automatically — enter the nutrition info below.
          </p>
          <div className={styles.manualFields}>
            <label className={styles.fieldLabel}>
              Dish name
              <input
                className={styles.fieldInput}
                value={scan.manualForm.name}
                onChange={(e) => scan.patchManualForm({ name: e.target.value })}
                placeholder="e.g. Chicken pasta"
              />
            </label>
            <label className={styles.fieldLabel}>
              Calories (kcal)
              <input
                className={styles.fieldInput}
                type="number"
                min={0}
                value={scan.manualForm.calories}
                onChange={(e) => scan.patchManualForm({ calories: e.target.value })}
                placeholder="e.g. 520"
              />
            </label>
            <div className={styles.macroRow}>
              {(['protein', 'carbs', 'fat'] as const).map((k) => (
                <label key={k} className={styles.fieldLabel}>
                  {k.charAt(0).toUpperCase() + k.slice(1)} (g)
                  <input
                    className={styles.fieldInput}
                    type="number"
                    min={0}
                    value={scan.manualForm[k]}
                    onChange={(e) => scan.patchManualForm({ [k]: e.target.value })}
                    placeholder="0"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {scan.stage === 'error' && (
        <div className={styles.error}>
          <p className={styles.errorMsg}>{scan.errorMessage}</p>
          <button className={`${styles.btn} ${styles.primary}`} onClick={scan.retry}>
            Try again
          </button>
        </div>
      )}
    </Modal>
  );
}

/* ── Inline helpers ── */
function VisionProviderPicker({
  value,
  onChange,
}: {
  value: VisionProvider;
  onChange: (provider: VisionProvider) => void;
}) {
  return (
    <div className={styles.visionPicker}>
      <span className={styles.visionPickerLabel}>Vision model</span>
      <div className={styles.visionPickerOptions} role="group" aria-label="Vision model">
        {(['auto', 'gemini', 'nemotron'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`${styles.visionOption} ${value === option ? styles.visionOptionActive : ''}`}
            onClick={() => onChange(option)}
          >
            {option === 'auto' ? 'Auto' : option === 'gemini' ? 'Gemini' : 'Nemotron'}
          </button>
        ))}
      </div>
    </div>
  );
}

function PortionControl({ grams, onChange }: { grams: number; onChange: (g: number) => void }) {
  const [raw, setRaw] = useState(String(grams));
  useEffect(() => { setRaw(String(grams)); }, [grams]);

  function commit(value: string) {
    const n = parseInt(value, 10);
    const clamped = Number.isNaN(n) ? grams : Math.min(9999, Math.max(1, n));
    onChange(clamped);
    setRaw(String(clamped));
  }

  return (
    <div className={styles.portionControl}>
      <span className={styles.portionLabel}>Portion</span>
      <div className={styles.portionInput}>
        <button
          type="button"
          className={styles.portionStep}
          onClick={() => onChange(Math.max(1, grams - 10))}
          aria-label="Decrease portion"
        >
          −
        </button>
        <input
          className={styles.portionField}
          type="number"
          min={1}
          max={9999}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => commit(raw)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(raw); }}
          aria-label="Portion size in grams"
        />
        <span className={styles.portionUnit}>g</span>
        <button
          type="button"
          className={styles.portionStep}
          onClick={() => onChange(Math.min(9999, grams + 10))}
          aria-label="Increase portion"
        >
          +
        </button>
      </div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width={36} height={36} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.1-1.8a1 1 0 0 1 .9-.5h6.6a1 1 0 0 1 .9.5L17.3 7h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 3 5 13h6l-1 8 8-10h-6z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5 10 17.5 19 6.5" />
    </svg>
  );
}
function RetakeIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11a8 8 0 0 1 14-5l2 2M20 13a8 8 0 0 1-14 5l-2-2M18 4v4h-4M6 20v-4h4" />
    </svg>
  );
}
