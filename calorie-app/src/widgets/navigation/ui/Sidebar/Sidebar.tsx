import { IconHome, IconBook, IconChart, IconUser, IconFlame, IconCamera } from '../../../../shared/ui/icons';
import { useUserStore } from '../../../../entities/user';
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
  onSignOut: () => void;
}

export function Sidebar({ currentPage, onNavigate, onScan, onSignOut }: SidebarProps) {
  const user = useUserStore((s) => s.user);
  const initials = user?.displayName
    ? user.displayName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '??';

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
        <span className={styles.avatar}>{initials}</span>
        <div className={styles.footInfo}>
          <div className={styles.userName}>{user?.displayName ?? 'You'}</div>
          <div className={styles.plan}>{user?.email ?? ''}</div>
        </div>
        <button className={styles.signOutBtn} onClick={onSignOut} title="Sign out">
          <SignOutIcon />
        </button>
      </div>
    </aside>
  );
}

function SignOutIcon() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
