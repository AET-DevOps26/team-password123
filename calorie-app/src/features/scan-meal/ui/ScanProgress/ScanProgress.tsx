import { useState, useEffect } from 'react';
import styles from './ScanProgress.module.css';

const PHASES = [
  'Uploading photo',
  'Detecting food items',
  'Estimating portion size',
  'Calculating calories & macros',
];

const TICK_MS = 180;
const STEP_MIN = 3;
const STEP_MAX = 12;

interface ScanProgressProps {
  onDone: () => void;
}

export function ScanProgress({ onDone }: ScanProgressProps) {
  const [pct, setPct] = useState(6);
  const phase = Math.min(Math.floor((pct / 100) * PHASES.length), PHASES.length - 1);

  useEffect(() => {
    const interval = setInterval(() => {
      setPct((p) => {
        const next = p + STEP_MIN + Math.random() * (STEP_MAX - STEP_MIN);
        return next >= 100 ? 100 : next;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (pct >= 100) {
      const t = setTimeout(onDone, 520);
      return () => clearTimeout(t);
    }
  }, [pct, onDone]);

  return (
    <div className={styles.wrap}>
      <div className={styles.spinner}><span /></div>
      <div className={styles.phase}>{PHASES[phase]}…</div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.steps}>
        {PHASES.map((label, i) => (
          <div
            key={label}
            className={`${styles.step} ${i < phase ? styles.done : i === phase ? styles.active : ''}`}
          >
            <span className={styles.dot}>
              {i < phase ? <CheckIcon /> : i + 1}
            </span>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5 10 17.5 19 6.5" />
    </svg>
  );
}
