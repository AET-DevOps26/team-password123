import { IconCamera } from '../../../../shared/ui/icons';
import styles from './ScanMealButton.module.css';

interface ScanMealButtonProps {
  onClick: () => void;
  className?: string;
}

export function ScanMealButton({ onClick, className }: ScanMealButtonProps) {
  return (
    <button className={`${styles.btn} ${className ?? ''}`} onClick={onClick}>
      <IconCamera size={19} /> Scan a meal
    </button>
  );
}
