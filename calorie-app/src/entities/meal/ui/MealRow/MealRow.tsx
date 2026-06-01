import type { MealEntry } from '../../model/types';
import styles from './MealRow.module.css';

interface MealRowProps {
  meal: MealEntry;
}

export function MealRow({ meal }: MealRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.thumb} style={{ background: meal.tone }}>
        <span className={styles.thumbCap}>photo</span>
      </div>
      <div className={styles.body}>
        <div className={styles.top}>
          <span className={styles.slot}>{meal.slot}</span>
          <span className={styles.time}>{meal.time}</span>
        </div>
        <div className={styles.name}>{meal.name}</div>
        <div className={styles.macros}>
          <span><i className={styles.dotProtein} />{meal.protein}p</span>
          <span><i className={styles.dotCarbs} />{meal.carbs}c</span>
          <span><i className={styles.dotFat} />{meal.fat}f</span>
        </div>
      </div>
      <div className={styles.cal}>
        <b>{meal.calories}</b>
        <span>kcal</span>
      </div>
    </div>
  );
}
