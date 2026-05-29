import { useState } from 'react';
import { Sidebar, Tabbar } from '../widgets/navigation';
import { Toast } from '../widgets/notification';
import { ScanModal } from '../features/scan-meal';
import { AuthPage } from '../features/auth';
import { useUserStore } from '../entities/user';
import { HomePage } from '../pages/home';
import { DiaryPage } from '../pages/diary';
import styles from './App.module.css';

export type Page = 'home' | 'diary' | 'insights' | 'profile';

export function App() {
  const token        = useUserStore((s) => s.token);
  const clearSession = useUserStore((s) => s.clearSession);

  const [page, setPage]         = useState<Page>('home');
  const [showScan, setShowScan] = useState(false);
  const [toast, setToast]       = useState<string | null>(null);

  // Not authenticated — show auth screen
  if (!token) {
    return <AuthPage />;
  }

  function handleAdded(kcal: number) {
    setShowScan(false);
    setToast(`Logged ${kcal} kcal to your diary`);
  }

  function handleSignOut() {
    clearSession();
    setPage('home');
  }

  return (
    <div className={styles.shell}>
      <Sidebar currentPage={page} onNavigate={setPage} onScan={() => setShowScan(true)} onSignOut={handleSignOut} />

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
