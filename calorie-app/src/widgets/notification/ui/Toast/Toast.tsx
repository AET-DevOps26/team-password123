import { useEffect } from 'react';
import styles from './Toast.module.css';

interface ToastProps {
  message: string;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ message, onDismiss, duration = 2600 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [onDismiss, duration]);

  return (
    <div className={styles.toast}>
      <span className={styles.icon}><CheckIcon /></span>
      {message}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5 10 17.5 19 6.5" />
    </svg>
  );
}
