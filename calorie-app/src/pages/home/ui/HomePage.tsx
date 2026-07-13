import { useEffect, useState, useCallback } from 'react';
import { CalorieRing, MacroBar } from '../../../entities/nutrition';
import { MealRow, useMealStore } from '../../../entities/meal';
import type { MealEntry } from '../../../entities/meal';
import { mealApi } from '../../../entities/meal/api/mealApi';
import { mealResponseToEntry } from '../../../entities/meal/model/mapper';
import { analyticsApi } from '../../../entities/nutrition/api/analyticsApi';
import type { AnalyticsResponse } from '../../../entities/nutrition/api/backendTypes';
import { useProfileStore } from '../../../entities/user/model/profile';
import { ScanMealButton } from '../../../features/scan-meal';
import { MealDetailModal } from '../../../features/meal-detail';
import { StatPill } from '../../../shared/ui/StatPill/StatPill';
import { localIsoDate } from '../../../shared/lib/timezone';
import { IconFlame, IconTarget, IconTrend, IconWater } from '../../../shared/ui/icons';
import styles from './HomePage.module.css';

interface HomePageProps {
  onScan: () => void;
  onOpenDiary: () => void;
}

export function HomePage({ onScan, onOpenDiary }: HomePageProps) {
  const entries     = useMealStore((s) => s.entries);
  const setEntries  = useMealStore((s) => s.setEntries);
  const goals       = useProfileStore((s) => s.goals);
  const displayName = useProfileStore((s) => s.displayName);
  const firstName   = displayName?.split(' ')[0] || 'there';

  const [dailyAnalytics, setDailyAnalytics] = useState<AnalyticsResponse | null>(null);
  const [weeklyAnalytics, setWeeklyAnalytics] = useState<AnalyticsResponse | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealEntry | null>(null);
  const [waterIntake, setWaterIntake] = useState(0);

  const todayKey = localIsoDate();
  const waterStorageKey = `waterIntake:${todayKey}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(waterStorageKey);
      setWaterIntake(saved ? Number(saved) || 0 : 0);
    } catch {
      setWaterIntake(0);
    }
  }, [waterStorageKey]);

  function setWater(next: number) {
    const clamped = Math.max(0, next);
    setWaterIntake(clamped);
    try {
      localStorage.setItem(waterStorageKey, String(clamped));
    } catch {
      /* ignore storage failures */
    }
  }

  function adjustWater(delta: number) {
    setWater(waterIntake + delta);
  }

  const refreshToday = useCallback(() => {
    const today = localIsoDate();
    mealApi.getHistory(today, today).then((raw) => {
      if (raw) setEntries(raw.map(mealResponseToEntry));
    }).catch(() => {});

    analyticsApi.getDaily(today).then((r) => {
      if (r) setDailyAnalytics(r);
    }).catch(() => {});
  }, [setEntries]);

  // Fetch today's data from API when backend is live
  useEffect(() => {
    const weekStart = (() => {
      const date = new Date();
      const day = date.getDay();
      date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
      return localIsoDate(date);
    })();

    refreshToday();

    // Load weekly analytics and streak KPI
    analyticsApi.getWeekly(weekStart).then((r) => {
      if (r) setWeeklyAnalytics(r);
    }).catch(() => {});

    analyticsApi.getStreak().then((r) => {
      if (r) setStreak(r.streak);
    }).catch(() => {});
  }, [refreshToday]);

  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const realDateLabel = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const dateLabel   = `Today, ${realDateLabel}`;
  const consumed    = dailyAnalytics ? Math.round(dailyAnalytics.calories)     : entries.reduce((s, e) => s + e.calories, 0);
  const protein     = dailyAnalytics ? Math.round(dailyAnalytics.proteinGrams) : entries.reduce((s, e) => s + e.protein,  0);
  const carbs       = dailyAnalytics ? Math.round(dailyAnalytics.carbsGrams)   : entries.reduce((s, e) => s + e.carbs,    0);
  const fat         = dailyAnalytics ? Math.round(dailyAnalytics.fatGrams)     : entries.reduce((s, e) => s + e.fat,      0);

  const calGoal     = goals.calories || 2000;
  const proteinGoal = goals.protein  || 120;
  const carbsGoal   = goals.carbs    || 220;
  const fatGoal     = goals.fats     || 65;

  const streakValue = streak ?? 0;
  const goalHit = dailyAnalytics
    ? (((dailyAnalytics.calorieGoalDelta ?? 0) <= 0) ? 'On track' : 'Over goal')
    : (entries.length > 0 ? 'Logged' : '—');
  const weekAvg = weeklyAnalytics ? Math.round(weeklyAnalytics.calories / 7).toLocaleString() : '—';
  const waterGoal = goals.water || 2000;
  const waterPct = Math.min(100, Math.round((waterIntake / waterGoal) * 100));

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <div>
          <div className={styles.eyebrow}>{dateLabel}</div>
          <h1 className={styles.title}>{greeting}, {firstName}</h1>
        </div>
        <div className={styles.headActions}>
          <ScanMealButton onClick={onScan} label="Scan a meal for today" />
        </div>
      </header>

      <div className={styles.grid}>
        <section className={`${styles.card} ${styles.summaryCard}`}>
          <CalorieRing value={consumed} goal={calGoal} />
          <div className={styles.macros}>
            <MacroBar label="Protein" value={protein} goal={proteinGoal} color="var(--protein)" />
            <MacroBar label="Carbs"   value={carbs}   goal={carbsGoal}   color="var(--carbs)" />
            <MacroBar label="Fat"     value={fat}     goal={fatGoal}     color="var(--fat)" />
          </div>
        </section>

        <div className={styles.stats}>
          <StatPill icon={<IconFlame size={18} />}  label="day streak" value={streakValue} />
          <StatPill icon={<IconTarget size={18} />} label="goal hit"   value={goalHit} />
          <StatPill icon={<IconTrend size={18} />}  label="7-day avg"  value={weekAvg} />
        </div>
      </div>

      <section className={styles.hydrationCard}>
        <div className={styles.hydrationHead}>
          <div className={styles.hydrationIcon}><IconWater size={20} /></div>
          <div>
            <div className={styles.hydrationTitle}>Water</div>
            <div className={styles.hydrationText}>{waterIntake.toLocaleString()} of {waterGoal.toLocaleString()} ml today</div>
          </div>
        </div>

        <div className={styles.hydrationBar} aria-label="Water intake progress">
          <div className={styles.hydrationFill} style={{ width: `${waterPct}%` }} />
        </div>

        <div className={styles.hydrationActions}>
          <button className={styles.hydrationBtn} onClick={() => adjustWater(-250)} type="button">-250 ml</button>
          <button className={styles.hydrationBtnPrimary} onClick={() => adjustWater(250)} type="button">+250 ml</button>
          <button className={styles.hydrationBtn} onClick={() => adjustWater(500)} type="button">+500 ml</button>
        </div>
      </section>

      <section className={styles.mealsSection}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Today's meals</h2>
          <span className={styles.sectionMeta}>{entries.length} logged</span>
        </div>
        <div className={styles.mealsList}>
          {entries.length > 0 ? (
            entries.map((meal) => (
              <MealRow key={meal.id} meal={meal} onSelect={setSelectedMeal} />
            ))
          ) : (
            <div className={styles.emptyMeals}>
              <div className={styles.emptyTitle}>No meals logged yet</div>
              <div className={styles.emptyText}>
                Add your first meal to start tracking calories and macros.
              </div>
              <div className={styles.emptyActions}>
                <button className={styles.emptyAction} onClick={onOpenDiary} type="button">
                  Add a new meal
                </button>
                <button className={styles.emptyLink} onClick={onScan} type="button">
                  or scan one now
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {selectedMeal && (
        <MealDetailModal
          meal={selectedMeal}
          onClose={() => setSelectedMeal(null)}
          onSaved={refreshToday}
          onDeleted={refreshToday}
        />
      )}
    </div>
  );
}
