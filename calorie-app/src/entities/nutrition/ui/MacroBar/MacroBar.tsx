import styles from './MacroBar.module.css';

interface MacroBarProps {
  label: string;
  value: number;
  goal: number;
  color: string;
}

export function MacroBar({ label, value, goal, color }: MacroBarProps) {
  const pct = Math.min(value / goal, 1) * 100;
  return (
    <div className={styles.macro}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        <span className={styles.val}><b>{value}</b> / {goal} g</span>
      </div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
