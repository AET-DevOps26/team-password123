import type { MealEntry } from '../../model/types';
import { useMealPhoto } from '../../lib/useMealPhoto';
import styles from './MealRow.module.css';

interface MealRowProps {
  meal: MealEntry;
  onSelect?: (meal: MealEntry) => void;
}

export function MealRow({ meal, onSelect }: MealRowProps) {
  const photoSrc = useMealPhoto(meal.imageUrl);

  const content = (
    <>
      <div className={styles.thumb} style={{ background: meal.tone }}>
        {photoSrc
          ? <img src={photoSrc} alt={meal.name} className={styles.thumbImg} />
          : <span className={styles.thumbCap}>photo</span>}
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
    </>
  );

  if (!onSelect) {
    return <div className={styles.row}>{content}</div>;
  }

  return (
    <button
      className={`${styles.row} ${styles.clickable}`}
      onClick={() => onSelect(meal)}
      type="button"
      aria-label={`View ${meal.name}, ${meal.calories} calories`}
    >
      {content}
    </button>
  );
}
