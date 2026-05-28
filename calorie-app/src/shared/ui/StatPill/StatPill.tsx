import styles from './StatPill.module.css';

interface StatPillProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

export function StatPill({ icon, label, value }: StatPillProps) {
  return (
    <div className={styles.pill}>
      <span className={styles.icon}>{icon}</span>
      <div>
        <div className={styles.value}>{value}</div>
        <div className={styles.label}>{label}</div>
      </div>
    </div>
  );
}
