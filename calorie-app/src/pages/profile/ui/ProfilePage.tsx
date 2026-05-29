import { useState } from 'react';
import { useProfileStore } from '../../../entities/user/model/profile';
import { useUserStore } from '../../../entities/user';
import { goalsApi } from '../../../entities/nutrition/api/goalsApi';
import { MOCK_MODE } from '../../../shared/config/flags';
import styles from './ProfilePage.module.css';

interface Props {
  onSignOut: () => void;
}

export function ProfilePage({ onSignOut }: Props) {
  const profile = useProfileStore();
  const user    = useUserStore((s) => s.user);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  function patchGoal(key: keyof typeof profile.goals, delta: number) {
    profile.patch({ goals: { ...profile.goals, [key]: Math.max(0, profile.goals[key] + delta) } });
    setSaved(false);
  }

  async function saveGoals() {
    if (MOCK_MODE) return;
    setSaving(true);
    try {
      await goalsApi.save({
        dailyCalories: profile.goals.calories,
        proteinGrams:  profile.goals.protein,
        carbsGrams:    profile.goals.carbs,
        fatGrams:      profile.goals.fats,
        fiberGrams:    0,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Profile</h1>

      {/* ── Profile info ── */}
      <Section label="Profile">
        <RowInput
          label="Name"
          value={profile.displayName}
          onChange={(v) => profile.patch({ displayName: v })}
          placeholder="Your name"
        />
        <Divider />
        <RowInput
          label="Email"
          value={user?.email ?? ''}
          onChange={() => {}}
          placeholder="Email (optional)"
          readOnly
        />
      </Section>

      {/* ── Daily goals ── */}
      <Section label="Daily goals">
        {!MOCK_MODE && (
          <div className={styles.saveRow}>
            <button
              className={`${styles.saveBtn} ${saved ? styles.saveBtnDone : ''}`}
              onClick={saveGoals}
              disabled={saving}
            >
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save goals'}
            </button>
          </div>
        )}
        <StepperRow
          label="Calories"
          dot={null}
          value={profile.goals.calories}
          unit="kcal"
          onDec={() => patchGoal('calories', -50)}
          onInc={() => patchGoal('calories', 50)}
        />
        <Divider />
        <StepperRow
          label="Protein"
          dot="protein"
          value={profile.goals.protein}
          unit="g"
          onDec={() => patchGoal('protein', -5)}
          onInc={() => patchGoal('protein', 5)}
        />
        <Divider />
        <StepperRow
          label="Carbs"
          dot="carbs"
          value={profile.goals.carbs}
          unit="g"
          onDec={() => patchGoal('carbs', -5)}
          onInc={() => patchGoal('carbs', 5)}
        />
        <Divider />
        <StepperRow
          label="Fats"
          dot="fats"
          value={profile.goals.fats}
          unit="g"
          onDec={() => patchGoal('fats', -5)}
          onInc={() => patchGoal('fats', 5)}
        />
        <Divider />
        <StepperRow
          label="Water"
          dot="water"
          value={profile.goals.water}
          unit="ml"
          onDec={() => patchGoal('water', -100)}
          onInc={() => patchGoal('water', 100)}
        />
      </Section>

      {/* ── Reminders ── */}
      <Section label="Reminders">
        <div className={styles.toggleRow}>
          <span className={styles.rowLabel}>Daily reminder</span>
          <button
            className={`${styles.toggle} ${profile.remindersEnabled ? styles.toggleOn : ''}`}
            onClick={() => profile.patch({ remindersEnabled: !profile.remindersEnabled })}
            aria-label="Toggle daily reminder"
          >
            <span className={styles.toggleThumb} />
          </button>
        </div>
      </Section>

      {/* ── Account ── */}
      <Section label="Account">
        <button className={styles.signOutBtn} onClick={onSignOut}>
          Sign out
        </button>
      </Section>
    </div>
  );
}

/* ── Section wrapper ── */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <p className={styles.sectionLabel}>{label}</p>
      <div className={styles.card}>{children}</div>
    </div>
  );
}

function Divider() {
  return <div className={styles.divider} />;
}

/* ── Editable text row ── */
function RowInput({
  label, value, onChange, placeholder, readOnly,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; readOnly?: boolean;
}) {
  return (
    <div className={styles.inputRow}>
      <span className={styles.rowLabel}>{label}</span>
      <input
        className={styles.inlineInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
      />
    </div>
  );
}

/* ── Stepper row ── */
type DotColor = 'protein' | 'carbs' | 'fats' | 'water' | null;

function StepperRow({
  label, dot, value, unit, onDec, onInc,
}: {
  label: string; dot: DotColor; value: number; unit: string;
  onDec: () => void; onInc: () => void;
}) {
  return (
    <div className={styles.stepperRow}>
      <span className={styles.rowLabel}>
        {dot && <span className={`${styles.dot} ${styles[`dot_${dot}`]}`} />}
        {label}
      </span>
      <div className={styles.stepperRight}>
        <span className={styles.stepperVal}>{value.toLocaleString()} {unit}</span>
        <div className={styles.stepperBtns}>
          <button className={styles.stepBtn} onClick={onDec}>−</button>
          <div className={styles.stepBtnDiv} />
          <button className={styles.stepBtn} onClick={onInc}>+</button>
        </div>
      </div>
    </div>
  );
}
