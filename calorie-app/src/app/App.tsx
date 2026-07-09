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
import { InsightsPage } from '../pages/insights';
import type { InsightsSnapshot } from '../pages/insights';
import { ProfilePage } from '../pages/profile';
import styles from './App.module.css';

export type Page = 'home' | 'diary' | 'insights' | 'profile';

export function App() {
  const token        = useUserStore((s) => s.token);
  const user         = useUserStore((s) => s.user);
  const clearSession = useUserStore((s) => s.clearSession);
  const onboardingComplete = useProfileStore((s) => s.onboardingComplete);

  const [page, setPage]         = useState<Page>('home');
  const [diaryOffset, setDiaryOffset] = useState(0);
  const [fromInsights, setFromInsights] = useState(false);
  const [insightsSnapshot, setInsightsSnapshot] = useState<InsightsSnapshot | undefined>(undefined);
  const [showScan, setShowScan] = useState(false);
  const [toast, setToast]       = useState<string | null>(null);

  function navigate(p: Page) {
    if (p !== 'diary') setFromInsights(false);
    if (p !== 'insights') setInsightsSnapshot(undefined);
    if (p === 'diary') setDiaryOffset(0);
    setPage(p);
  }

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
      <Sidebar currentPage={page} onNavigate={navigate} onScan={() => setShowScan(true)} onSignOut={handleSignOut} />

      <main className={styles.main}>
        <div className={styles.content}>
          {page === 'home'     && <HomePage  onScan={() => setShowScan(true)} onOpenDiary={() => setPage('diary')} />}
          {page === 'diary'    && (
            <DiaryPage
              onScan={() => setShowScan(true)}
              initialOffset={diaryOffset}
              onOffsetChange={setDiaryOffset}
              onBack={fromInsights ? () => { setFromInsights(false); setPage('insights'); } : undefined}
            />
          )}
          {page === 'insights' && <InsightsPage
            initialState={insightsSnapshot}
            onOpenDay={(offset, snapshot) => {
              setDiaryOffset(offset);
              setInsightsSnapshot(snapshot);
              setFromInsights(true);
              setPage('diary');
            }}
          />}
          {page === 'profile'  && <ProfilePage onSignOut={handleSignOut} />}
        </div>
      </main>

      <Tabbar currentPage={page} onNavigate={navigate} onScan={() => setShowScan(true)} />

      {showScan && (
        <ScanModal onClose={() => setShowScan(false)} onAdded={handleAdded} />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
