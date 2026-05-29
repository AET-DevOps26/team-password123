import { IconHome, IconBook, IconChart, IconUser, IconFlame, IconCamera } from '../../../../shared/ui/icons';
import type { Page } from '../../../../app/App';
import styles from './Sidebar.module.css';

const NAV: { id: Page; label: string; Icon: React.FC<{ size?: number }>; enabled: boolean }[] = [
  { id: 'home',     label: 'Today',    Icon: IconHome,  enabled: true  },
  { id: 'diary',    label: 'Diary',    Icon: IconBook,  enabled: true  },
  { id: 'insights', label: 'Insights', Icon: IconChart, enabled: false },
  { id: 'profile',  label: 'Profile',  Icon: IconUser,  enabled: false },
];

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onScan: () => void;
}

export function Sidebar({ currentPage, onNavigate, onScan }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}><IconFlame size={18} /></span>
        <span className={styles.brandName}>calorie<b>easy</b></span>
      </div>

      {NAV.map(({ id, label, Icon, enabled }) => (
        <button
          key={id}
          className={`${styles.navItem} ${currentPage === id ? styles.active : ''} ${!enabled ? styles.disabled : ''}`}
          onClick={() => enabled && onNavigate(id)}
          disabled={!enabled}
        >
          <Icon size={21} /> {label}
        </button>
      ))}

      <button className={styles.scanBtn} onClick={onScan}>
        <IconCamera size={19} /> Scan a meal
      </button>

      <div className={styles.foot}>
        <span className={styles.avatar}>MC</span>
        <div>
          <div className={styles.userName}>Mia Carter</div>
          <div className={styles.plan}>Free plan</div>
        </div>
      </div>
    </aside>
  );
}
