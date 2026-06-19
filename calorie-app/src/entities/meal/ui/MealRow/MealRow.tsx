import { useEffect, useState } from 'react';
import type { MealEntry } from '../../model/types';
import { fetchBlobUrl } from '../../../../shared/api/client';
import styles from './MealRow.module.css';

interface MealRowProps {
  meal: MealEntry;
}

/**
 * Resolve a MealEntry.imageUrl to a renderable <img src>. Local data:/blob: URLs
 * (just-scanned meals) are used as-is; backend `/api/...` paths are fetched with
 * the auth header into an object URL. Returns null while loading or absent.
 */
function useMealPhoto(imageUrl?: string): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) { setSrc(null); return; }
    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
      setSrc(imageUrl);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    fetchBlobUrl(imageUrl).then((url) => {
      if (!active) { if (url) URL.revokeObjectURL(url); return; }
      objectUrl = url;
      setSrc(url);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageUrl]);

  return src;
}

export function MealRow({ meal }: MealRowProps) {
  const photoSrc = useMealPhoto(meal.imageUrl);

  return (
    <div className={styles.row}>
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
    </div>
  );
}
