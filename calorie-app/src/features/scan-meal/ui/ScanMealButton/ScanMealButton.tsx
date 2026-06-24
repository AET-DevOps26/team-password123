import { IconCamera } from '../../../../shared/ui/icons';
import styles from './ScanMealButton.module.css';

interface ScanMealButtonProps {
  onClick: () => void;
  className?: string;
  /** Distinct accessible name; falls back to the visible "Scan a meal" text.
   *  Used by the Home and Diary headers; each passes a unique label so it never
   *  collides with the sidebar's and tab bar's own scan buttons. */
  label?: string;
}

export function ScanMealButton({ onClick, className, label }: ScanMealButtonProps) {
  return (
    <button className={`${styles.btn} ${className ?? ''}`} onClick={onClick} aria-label={label} type="button">
      <IconCamera size={19} /> Scan a meal
    </button>
  );
}
