import styles from './CalorieRing.module.css';

interface CalorieRingProps {
  value: number;
  goal: number;
  size?: number;
  thickness?: number;
}

export function CalorieRing({ value, goal, size = 188, thickness = 16 }: CalorieRingProps) {
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(value / goal, 1);
  const remaining = Math.max(goal - value, 0);

  return (
    <div className={styles.wrap} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--track)" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--green)" strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div className={styles.center}>
        <span className={styles.num}>{remaining.toLocaleString()}</span>
        <span className={styles.label}>kcal left</span>
        <span className={styles.sub}>{value.toLocaleString()} of {goal.toLocaleString()}</span>
      </div>
    </div>
  );
}
