import { Sidebar, Tabbar } from '../widgets/navigation';
import { HomePage } from '../pages/home';
import styles from './App.module.css';

export function App() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.content}>
          <HomePage />
        </div>
      </main>
      <Tabbar />
    </div>
  );
}
