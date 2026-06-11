import { useState, useMemo, useEffect, useCallback } from 'react';
import { useMealStore, MealRow } from '../../../entities/meal';
import { getMockMealsForOffset } from '../../../entities/meal/model/mock';
import { mealApi } from '../../../entities/meal/api/mealApi';
import { mealResponseToEntry } from '../../../entities/meal/model/mapper';
import type { MealEntry } from '../../../entities/meal';
import { MacroChip, MOCK_GOAL } from '../../../entities/nutrition';
import { useProfileStore } from '../../../entities/user/model/profile';
import { ScanMealButton } from '../../../features/scan-meal';
import { ManualEntryModal } from '../../../features/manual-entry';
import type { MealSlot } from '../../../features/manual-entry/model/useManualEntry';
import { Toast } from '../../../widgets/notification';
import { MOCK_MODE } from '../../../shared/config/flags';
import styles from './DiaryPage.module.css';

// Anchor for date math — same as InsightsPage
const DIARY_ANCHOR = new Date(2026, 4, 28);

function getDiaryBaseDate(): Date {
  return MOCK_MODE ? new Date(DIARY_ANCHOR) : new Date();
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const SLOTS: MealSlot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

interface DiaryPageProps {
  onScan: () => void;
  initialOffset?: number;
  onOffsetChange?: (offset: number) => void;
  onBack?: () => void;
}

export function DiaryPage({ onScan, initialOffset = 0, onOffsetChange, onBack }: DiaryPageProps) {
  const storeEntries = useMealStore((s) => s.entries);
  const goals        = useProfileStore((s) => s.goals);
  const [showManual,   setShowManual]  = useState(false);
  const [defaultSlot,  setDefaultSlot] = useState<MealSlot>('Lunch');
  const [offset,       setOffsetState] = useState(initialOffset);
  const [apiEntries,   setApiEntries]  = useState<MealEntry[] | null>(null);

  function setOffset(n: number) {
    setOffsetState(n);
    onOffsetChange?.(n);
  }
  const [toast, setToast] = useState<string | null>(null);

  // Compute ISO date string for a given offset relative to the anchor
  function offsetToIsoDate(off: number): string {
    return toLocalIsoDate(addDays(getDiaryBaseDate(), off));
  }

  // Fetch meals from API when MOCK_MODE is off
  const fetchMeals = useCallback(async (off: number) => {
    if (MOCK_MODE) return;
    try {
      const date = offsetToIsoDate(off);
      const raw  = await mealApi.getHistory(date, date);
      setApiEntries((raw ?? []).map(mealResponseToEntry));
    } catch {
      setApiEntries([]);
    }
  }, []);

  useEffect(() => { fetchMeals(offset); }, [offset, fetchMeals]);

  // Determine which entries to show
  const mockEntries = useMemo(() => getMockMealsForOffset(offset), [offset]);
  const entries: MealEntry[] = MOCK_MODE
    ? (offset !== 0 ? mockEntries : storeEntries)
    : (apiEntries ?? storeEntries);

  const calGoal = MOCK_MODE ? MOCK_GOAL.calories : (goals.calories || 2000);

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
    // Re-fetch the day so the new entry appears (real API path)
    if (!MOCK_MODE) fetchMeals(offset);
  }

  const viewDate = addDays(getDiaryBaseDate(), offset);
  const dateLabel = offset === 0
    ? `Today, ${viewDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })}`
    : viewDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  // Week strip — 7 days of the week containing viewDate
  function getMondayOffset(baseOffset: number): number {
    const d = addDays(getDiaryBaseDate(), baseOffset);
    const dow = d.getDay();
    return baseOffset - (dow === 0 ? 6 : dow - 1);
  }
  const WD_STRIPS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const mondayOffset = getMondayOffset(offset);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const dayOffset = mondayOffset + i;
    const d = addDays(getDiaryBaseDate(), dayOffset);
    return { offset: dayOffset, dayNum: d.getDate(), label: WD_STRIPS[i], isToday: dayOffset === 0 };
  });

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

      {/* Week day strip */}
      <div className={styles.weekStrip}>
        {weekDays.map((d) => (
          <button
            key={d.offset}
            className={`${styles.dayPill} ${d.offset === offset ? styles.dayPillActive : ''} ${d.isToday && d.offset !== offset ? styles.dayPillToday : ''}`}
            onClick={() => setOffset(d.offset)}
            disabled={d.offset > 0}
          >
            <span className={styles.dayPillLabel}>{d.label}</span>
            <span className={styles.dayPillNum}>{d.dayNum}</span>
          </button>
        ))}
      </div>

      {/* Day total */}
      <div className={`${styles.card} ${styles.dayTotal}`}>
        <div>
          <div className={styles.totalMeta}>Total today</div>
          <div className={styles.totalNum}>
            {totalCal.toLocaleString()}
            <span> / {calGoal.toLocaleString()} kcal</span>
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
          loggedAt={viewDate}
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
