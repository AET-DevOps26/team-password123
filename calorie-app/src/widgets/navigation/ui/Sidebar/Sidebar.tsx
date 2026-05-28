import { IconHome, IconBook, IconChart, IconUser, IconFlame, IconCamera } from '../../../../shared/ui/icons';
import styles from './Sidebar.module.css';

const NAV = [
  { id: 'home',      label: 'Today',    Icon: IconHome,  active: true  },
  { id: 'diary',     label: 'Diary',    Icon: IconBook,  active: false },
  { id: 'analytics', label: 'Insights', Icon: IconChart, active: false },
  { id: 'profile',   label: 'Profile',  Icon: IconUser,  active: false },
] as const;

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}><IconFlame size={18} /></span>
        <span className={styles.brandName}>calorie<b>easy</b></span>
      </div>

      {NAV.map(({ id, label, Icon, active }) => (
        <button
          key={id}
          className={`${styles.navItem} ${active ? styles.active : styles.disabled}`}
          disabled={!active}
        >
          <Icon size={21} /> {label}
        </button>
      ))}

      <button className={styles.scanBtn}>
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
