import styles from './MacroChip.module.css';

interface MacroChipProps {
  color: string;
  label: string;
  value: string;
}

export function MacroChip({ color, label, value }: MacroChipProps) {
  return (
    <div className={styles.chip}>
      <span className={styles.dot} style={{ background: color }} />
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}
