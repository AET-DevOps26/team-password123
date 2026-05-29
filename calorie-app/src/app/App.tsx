import { useState } from 'react';
import { Sidebar, Tabbar } from '../widgets/navigation';
import { Toast } from '../widgets/notification';
import { ScanModal } from '../features/scan-meal';
import { AuthPage } from '../features/auth';
import { OnboardingFlow } from '../features/onboarding';
import { useUserStore } from '../entities/user';
import { useProfileStore } from '../entities/user/model/profile';
import { HomePage } from '../pages/home';
import { DiaryPage } from '../pages/diary';
import { ProfilePage } from '../pages/profile';
import styles from './App.module.css';

export type Page = 'home' | 'diary' | 'insights' | 'profile';

export function App() {
  const token        = useUserStore((s) => s.token);
  const user         = useUserStore((s) => s.user);
  const clearSession = useUserStore((s) => s.clearSession);
  const onboardingComplete = useProfileStore((s) => s.onboardingComplete);

  const [page, setPage]         = useState<Page>('home');
  const [showScan, setShowScan] = useState(false);
  const [toast, setToast]       = useState<string | null>(null);

  if (!token) {
    return <AuthPage />;
  }

  if (!onboardingComplete) {
    return <OnboardingFlow defaultName={user?.displayName ?? 'Me'} />;
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
          {page === 'home'    && <HomePage  onScan={() => setShowScan(true)} />}
          {page === 'diary'   && <DiaryPage onScan={() => setShowScan(true)} />}
          {page === 'profile' && <ProfilePage onSignOut={handleSignOut} />}
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
