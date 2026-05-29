import { useState } from 'react';
import { Sidebar, Tabbar } from '../widgets/navigation';
import { Toast } from '../widgets/notification';
import { ScanModal } from '../features/scan-meal';
import { HomePage } from '../pages/home';
import styles from './App.module.css';

export function App() {
  const [showScan, setShowScan] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function handleAdded(kcal: number) {
    setShowScan(false);
    setToast(`Logged ${kcal} kcal to your diary`);
  }

  return (
    <div className={styles.shell}>
      <Sidebar onScan={() => setShowScan(true)} />

      <main className={styles.main}>
        <div className={styles.content}>
          <HomePage onScan={() => setShowScan(true)} />
        </div>
      </main>

      <Tabbar onScan={() => setShowScan(true)} />

      {showScan && (
        <ScanModal onClose={() => setShowScan(false)} onAdded={handleAdded} />
      )}

      {toast && (
        <Toast message={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
