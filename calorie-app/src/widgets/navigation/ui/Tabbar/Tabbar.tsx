import { IconHome, IconBook, IconChart, IconUser, IconCamera } from '../../../../shared/ui/icons';
import styles from './Tabbar.module.css';

export function Tabbar() {
  return (
    <nav className={styles.tabbar}>
      <button className={`${styles.tab} ${styles.active}`}>
        <IconHome size={23} /><span>Today</span>
      </button>
      <button className={`${styles.tab} ${styles.disabled}`} disabled>
        <IconBook size={23} /><span>Diary</span>
      </button>
      <div className={styles.fabWrap}>
        <button className={styles.fab}><IconCamera size={26} /></button>
      </div>
      <button className={`${styles.tab} ${styles.disabled}`} disabled>
        <IconChart size={23} /><span>Insights</span>
      </button>
      <button className={`${styles.tab} ${styles.disabled}`} disabled>
        <IconUser size={23} /><span>Profile</span>
      </button>
    </nav>
  );
}
