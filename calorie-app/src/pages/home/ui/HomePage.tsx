import { CalorieRing, MacroBar, MOCK_GOAL, MOCK_TODAY, MOCK_STATS } from '../../../entities/nutrition';
import { MealRow, useMealStore } from '../../../entities/meal';
import { useUserStore } from '../../../entities/user';
import { ScanMealButton } from '../../../features/scan-meal';
import { StatPill } from '../../../shared/ui/StatPill/StatPill';
import { IconFlame, IconTarget, IconTrend, IconBolt, IconChevR } from '../../../shared/ui/icons';
import styles from './HomePage.module.css';

interface HomePageProps {
  onScan: () => void;
}

export function HomePage({ onScan }: HomePageProps) {
  const entries = useMealStore((s) => s.entries);
  const user    = useUserStore((s) => s.user);
  const firstName = user?.displayName?.split(' ')[0] ?? 'there';

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <div>
          <div className={styles.eyebrow}>{MOCK_TODAY.dateLabel}</div>
          <h1 className={styles.title}>Good afternoon, {firstName}</h1>
        </div>
        <div className={styles.headActions}>
          <ScanMealButton onClick={onScan} />
        </div>
      </header>

      <div className={styles.grid}>
        <section className={`${styles.card} ${styles.summaryCard}`}>
          <CalorieRing value={MOCK_TODAY.consumed} goal={MOCK_GOAL.calories} />
          <div className={styles.macros}>
            <MacroBar label="Protein" value={MOCK_TODAY.protein} goal={MOCK_GOAL.protein} color="var(--protein)" />
            <MacroBar label="Carbs"   value={MOCK_TODAY.carbs}   goal={MOCK_GOAL.carbs}   color="var(--carbs)" />
            <MacroBar label="Fat"     value={MOCK_TODAY.fat}     goal={MOCK_GOAL.fat}     color="var(--fat)" />
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
          <StatPill icon={<IconFlame size={18} />}  label="day streak" value={MOCK_STATS.streak} />
          <StatPill icon={<IconTarget size={18} />} label="goal hit"   value={`${Math.round(MOCK_STATS.goalAdherence * 100)}%`} />
          <StatPill icon={<IconTrend size={18} />}  label="7-day avg"  value={MOCK_STATS.weekAvg.toLocaleString()} />
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
