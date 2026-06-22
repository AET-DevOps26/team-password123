import { useEffect, useState } from 'react';
import { CalorieRing, MacroBar, MOCK_GOAL, MOCK_TODAY, MOCK_STATS } from '../../../entities/nutrition';
import { MealRow, useMealStore } from '../../../entities/meal';
import { mealApi } from '../../../entities/meal/api/mealApi';
import { mealResponseToEntry } from '../../../entities/meal/model/mapper';
import { analyticsApi } from '../../../entities/nutrition/api/analyticsApi';
import type { AnalyticsResponse } from '../../../entities/nutrition/api/backendTypes';
import { useProfileStore } from '../../../entities/user/model/profile';
import { ScanMealButton } from '../../../features/scan-meal';
import { StatPill } from '../../../shared/ui/StatPill/StatPill';
import { IconFlame, IconTarget, IconTrend, IconBolt, IconChevR } from '../../../shared/ui/icons';
import { MOCK_MODE } from '../../../shared/config/flags';
import styles from './HomePage.module.css';

interface HomePageProps {
  onScan: () => void;
}

export function HomePage({ onScan }: HomePageProps) {
  const entries     = useMealStore((s) => s.entries);
  const setEntries  = useMealStore((s) => s.setEntries);
  const goals       = useProfileStore((s) => s.goals);
  const displayName = useProfileStore((s) => s.displayName);
  const firstName   = displayName?.split(' ')[0] || 'there';

  const [dailyAnalytics, setDailyAnalytics] = useState<AnalyticsResponse | null>(null);
  const [weeklyAnalytics, setWeeklyAnalytics] = useState<AnalyticsResponse | null>(null);
  const [streak, setStreak] = useState<number | null>(null);

  // Fetch today's data from API when backend is live
  useEffect(() => {
    if (MOCK_MODE) return;
    const today = new Date().toISOString().slice(0, 10);
    const weekStart = (() => {
      const date = new Date();
      const day = date.getDay();
      date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
      return date.toISOString().slice(0, 10);
    })();

    // Load today's meals into store
    mealApi.getHistory(today, today).then((raw) => {
      if (raw) setEntries(raw.map(mealResponseToEntry));
    }).catch(() => {});

    // Load daily analytics
    analyticsApi.getDaily(today).then((r) => {
      if (r) setDailyAnalytics(r);
    }).catch(() => {});

    // Load weekly analytics and streak KPI
    analyticsApi.getWeekly(weekStart).then((r) => {
      if (r) setWeeklyAnalytics(r);
    }).catch(() => {});

    analyticsApi.getStreak().then((r) => {
      if (r) setStreak(r.streak);
    }).catch(() => {});
  }, [setEntries]);

  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const realDateLabel = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const dateLabel   = MOCK_MODE ? MOCK_TODAY.dateLabel : `Today, ${realDateLabel}`;
  const consumed    = MOCK_MODE ? MOCK_TODAY.consumed  : (dailyAnalytics ? Math.round(dailyAnalytics.calories)     : entries.reduce((s, e) => s + e.calories, 0));
  const protein     = MOCK_MODE ? MOCK_TODAY.protein   : (dailyAnalytics ? Math.round(dailyAnalytics.proteinGrams) : entries.reduce((s, e) => s + e.protein,  0));
  const carbs       = MOCK_MODE ? MOCK_TODAY.carbs     : (dailyAnalytics ? Math.round(dailyAnalytics.carbsGrams)   : entries.reduce((s, e) => s + e.carbs,    0));
  const fat         = MOCK_MODE ? MOCK_TODAY.fat       : (dailyAnalytics ? Math.round(dailyAnalytics.fatGrams)     : entries.reduce((s, e) => s + e.fat,      0));

  const calGoal     = MOCK_MODE ? MOCK_GOAL.calories : (goals.calories || 2000);
  const proteinGoal = MOCK_MODE ? MOCK_GOAL.protein  : (goals.protein  || 120);
  const carbsGoal   = MOCK_MODE ? MOCK_GOAL.carbs    : (goals.carbs    || 220);
  const fatGoal     = MOCK_MODE ? MOCK_GOAL.fat      : (goals.fats     || 65);

  const streakValue = MOCK_MODE ? MOCK_STATS.streak : (streak ?? 0);
  const goalHit = MOCK_MODE
    ? `${Math.round(MOCK_STATS.goalAdherence * 100)}%`
    : (dailyAnalytics
      ? (((dailyAnalytics.calorieGoalDelta ?? 0) <= 0) ? 'On track' : 'Over goal')
      : (entries.length > 0 ? 'Logged' : '—'));
  const weekAvg = MOCK_MODE
    ? MOCK_STATS.weekAvg.toLocaleString()
    : (weeklyAnalytics ? Math.round(weeklyAnalytics.calories / 7).toLocaleString() : '—');

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

        <section className={`${styles.card} ${styles.insightCard}`} onClick={onScan}>
          <div className={styles.insightIcon}><IconBolt size={20} /></div>
          <div className={styles.insightBody}>
            <div className={styles.insightTitle}>Log your dinner in one snap</div>
            <div className={styles.insightText}>
              Point your camera at the plate — calorieasy reads the ingredients and
              estimates calories &amp; macros for you.
            </div>
          </div>
          <span className={styles.insightArrow}><IconChevR size={18} /></span>
        </section>

        <div className={styles.stats}>
          <StatPill icon={<IconFlame size={18} />}  label="day streak" value={streakValue} />
          <StatPill icon={<IconTarget size={18} />} label="goal hit"   value={goalHit} />
          <StatPill icon={<IconTrend size={18} />}  label="7-day avg"  value={weekAvg} />
        </div>
      </div>

      <section className={styles.mealsSection}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Today's meals</h2>
          <span className={styles.sectionMeta}>{entries.length} logged</span>
        </div>
        <div className={styles.mealsList}>
          {entries.map((meal) => <MealRow key={meal.id} meal={meal} />)}
        </div>
      </section>
    </div>
  );
}
