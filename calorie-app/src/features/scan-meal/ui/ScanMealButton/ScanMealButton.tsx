import { IconCamera } from '../../../../shared/ui/icons';
import styles from './ScanMealButton.module.css';

interface ScanMealButtonProps {
  className?: string;
}

export function ScanMealButton({ className }: ScanMealButtonProps) {
  return (
    <button className={`${styles.btn} ${className ?? ''}`}>
      <IconCamera size={19} /> Scan a meal
    </button>
  );
}
