import { IconHome, IconBook, IconChart, IconUser, IconCamera } from '../../../../shared/ui/icons';
import type { Page } from '../../../../app/App';
import styles from './Tabbar.module.css';

interface TabbarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onScan: () => void;
}

export function Tabbar({ currentPage, onNavigate, onScan }: TabbarProps) {
  return (
    <nav className={styles.tabbar}>
      <button
        className={`${styles.tab} ${currentPage === 'home' ? styles.active : ''}`}
        onClick={() => onNavigate('home')}
      >
        <IconHome size={23} /><span>Today</span>
      </button>

      <button
        className={`${styles.tab} ${currentPage === 'diary' ? styles.active : ''}`}
        onClick={() => onNavigate('diary')}
      >
        <IconBook size={23} /><span>Diary</span>
      </button>

      <div className={styles.fabWrap}>
        <button className={styles.fab} onClick={onScan} aria-label="Scan a meal" type="button"><IconCamera size={26} /></button>
      </div>

      <button
        className={`${styles.tab} ${currentPage === 'insights' ? styles.active : ''}`}
        onClick={() => onNavigate('insights')}
      >
        <IconChart size={23} /><span>Insights</span>
      </button>

      <button
        className={`${styles.tab} ${currentPage === 'profile' ? styles.active : ''}`}
        onClick={() => onNavigate('profile')}
      >
        <IconUser size={23} /><span>Profile</span>
      </button>
    </nav>
  );
}
