import { useState } from 'react';
import { useMealStore, MealRow } from '../../../entities/meal';
import type { MealEntry } from '../../../entities/meal';
import { MacroChip, MOCK_GOAL } from '../../../entities/nutrition';
import { ScanMealButton } from '../../../features/scan-meal';
import { ManualEntryModal } from '../../../features/manual-entry';
import type { MealSlot } from '../../../features/manual-entry/model/useManualEntry';
import { Toast } from '../../../widgets/notification';
import styles from './DiaryPage.module.css';

const SLOTS: MealSlot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

interface DiaryPageProps {
  onScan: () => void;
  initialOffset?: number;
  onOffsetChange?: (offset: number) => void;
  onBack?: () => void;
}

export function DiaryPage({ onScan, initialOffset = 0, onOffsetChange, onBack }: DiaryPageProps) {
  const entries = useMealStore((s) => s.entries);
  const [showManual, setShowManual] = useState(false);
  const [defaultSlot, setDefaultSlot] = useState<MealSlot>('Lunch');
  const [offset, setOffsetState] = useState(initialOffset);

  function setOffset(n: number) {
    setOffsetState(n);
    onOffsetChange?.(n);
  }
  const [toast, setToast] = useState<string | null>(null);

  const bySlot = (slot: MealSlot): MealEntry[] =>
    entries.filter((e) => e.slot === slot);

  const totalCal     = entries.reduce((s, e) => s + e.calories, 0);
  const totalProtein = entries.reduce((s, e) => s + e.protein, 0);
  const totalCarbs   = entries.reduce((s, e) => s + e.carbs, 0);
  const totalFat     = entries.reduce((s, e) => s + e.fat, 0);

  function openManual(slot: MealSlot = 'Lunch') {
    setDefaultSlot(slot);
    setShowManual(true);
  }

  function handleAdded(kcal: number) {
    setShowManual(false);
    setToast(`Logged ${kcal} kcal to your diary`);
  }

  // Use the same mock anchor as InsightsPage so diary offsets align
  const viewDate = new Date(2026, 4, 28);
  viewDate.setDate(viewDate.getDate() + offset);
  const dateLabel = offset === 0
    ? `Today, ${viewDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })}`
    : viewDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className={styles.screen}>
      {onBack && (
        <button className={styles.backBtn} onClick={onBack}>
          <ChevronLeftIcon /> Back to Insights
        </button>
      )}
      <header className={styles.head}>
        <div className={styles.headLeft}>
          <div className={styles.eyebrow}>Food diary</div>
          <div className={styles.titleRow}>
            <button className={styles.navArrow} onClick={() => setOffset(offset - 1)} aria-label="Previous day">
              <ChevronLeftIcon />
            </button>
            <h1 className={styles.title}>{dateLabel}</h1>
            <button
              className={styles.navArrow}
              onClick={() => setOffset(offset + 1)}
              disabled={offset >= 0}
              aria-label="Next day"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
        <div className={styles.actions}>
          <button className={`${styles.btn} ${styles.ghost}`} onClick={() => openManual()}>
            <PlusIcon /> Manual
          </button>
          <ScanMealButton onClick={onScan} />
        </div>
      </header>

      {/* Day total */}
      <div className={`${styles.card} ${styles.dayTotal}`}>
        <div>
          <div className={styles.totalMeta}>Total today</div>
          <div className={styles.totalNum}>
            {totalCal.toLocaleString()}
            <span> / {MOCK_GOAL.calories.toLocaleString()} kcal</span>
          </div>
        </div>
        <div className={styles.macros}>
          <MacroChip color="var(--protein)" label="Protein" value={`${totalProtein} g`} />
          <MacroChip color="var(--carbs)"   label="Carbs"   value={`${totalCarbs} g`} />
          <MacroChip color="var(--fat)"     label="Fat"     value={`${totalFat} g`} />
        </div>
      </div>

      {/* Slot groups */}
      {SLOTS.map((slot) => {
        const meals = bySlot(slot);
        const slotCal = meals.reduce((s, e) => s + e.calories, 0);
        return (
          <section key={slot} className={styles.slotGroup}>
            <div className={styles.slotHead}>
              <h3 className={styles.slotTitle}>{slot}</h3>
              <span className={styles.slotCal}>{slotCal > 0 ? `${slotCal} kcal` : '—'}</span>
            </div>

            {meals.length === 0 ? (
              <button
                className={styles.slotEmpty}
                onClick={() => openManual(slot)}
              >
                <PlusIcon /> Add {slot.toLowerCase()}
              </button>
            ) : (
              <div className={styles.mealList}>
                {meals.map((m) => <MealRow key={m.id} meal={m} />)}
                <button
                  className={styles.addMore}
                  onClick={() => openManual(slot)}
                >
                  <PlusIcon /> Add more
                </button>
              </div>
            )}
          </section>
        );
      })}

      {showManual && (
        <ManualEntryModal
          onClose={() => setShowManual(false)}
          onAdded={handleAdded}
          defaultSlot={defaultSlot}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
