import { useEffect, useState } from 'react';
import { analyticsApi } from '../../../entities/nutrition/api/analyticsApi';
import type { InsightResponse } from '../../../entities/nutrition/api/backendTypes';
import styles from './HealthInsightCard.module.css';

/**
 * Insights-page card showing a RAG-generated health insight.
 * Self-hiding: renders nothing when the backend reports the insight is
 * unavailable/empty, or when the fetch fails — so it never blocks the page.
 */
export function HealthInsightCard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InsightResponse | null>(null);
  const [showFacts, setShowFacts] = useState(false);

  useEffect(() => {
    let active = true;

    analyticsApi
      .getInsight('week')
      .then((res) => {
        if (!active) return;
        const usable =
          res.result !== 'unavailable' && !!res.insight && res.insight.trim().length > 0;
        setData(usable ? res : null);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Failed to load health insight', err);
        setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <section className={styles.card} aria-busy="true">
        <h2 className={styles.title}>Health insight</h2>
        <div className={styles.skeleton} aria-hidden="true">
          <span className={styles.skelLine} />
          <span className={`${styles.skelLine} ${styles.skelShort}`} />
        </div>
      </section>
    );
  }

  if (!data) return null;

  const facts = data.factsUsed;

  return (
    <section className={styles.card}>
      <h2 className={styles.title}>Health insight</h2>
      <p className={styles.body}>{data.insight}</p>

      {facts.length > 0 && (
        <div className={styles.facts}>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={showFacts}
            onClick={() => setShowFacts((v) => !v)}
          >
            Based on {facts.length} {facts.length === 1 ? 'fact' : 'facts'}
          </button>

          {showFacts && (
            <ul className={styles.factList}>
              {facts.map((fact) => (
                <li key={fact.id} className={styles.factItem}>
                  {fact.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
