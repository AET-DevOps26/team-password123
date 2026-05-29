import { useState } from 'react';
import { Sidebar, Tabbar } from '../widgets/navigation';
import { Toast } from '../widgets/notification';
import { ScanModal } from '../features/scan-meal';
import { HomePage } from '../pages/home';
import { DiaryPage } from '../pages/diary';
import styles from './App.module.css';

export type Page = 'home' | 'diary' | 'insights' | 'profile';

export function App() {
  const [page, setPage]         = useState<Page>('home');
  const [showScan, setShowScan] = useState(false);
  const [toast, setToast]       = useState<string | null>(null);

  function handleAdded(kcal: number) {
    setShowScan(false);
    setToast(`Logged ${kcal} kcal to your diary`);
  }

  return (
    <div className={styles.shell}>
      <Sidebar currentPage={page} onNavigate={setPage} onScan={() => setShowScan(true)} />

      <main className={styles.main}>
        <div className={styles.content}>
          {page === 'home'  && <HomePage  onScan={() => setShowScan(true)} />}
          {page === 'diary' && <DiaryPage onScan={() => setShowScan(true)} />}
        </div>
      </main>

      <Tabbar currentPage={page} onNavigate={setPage} onScan={() => setShowScan(true)} />

      {showScan && (
        <ScanModal onClose={() => setShowScan(false)} onAdded={handleAdded} />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
