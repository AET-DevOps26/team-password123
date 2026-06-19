import { useState } from 'react';
import { useProfileStore, calculateGoals } from '../../../../entities/user/model/profile';
import type { Sex, ActivityLevel, GoalKind } from '../../../../entities/user/model/profile';
import { authApi } from '../../../auth/api/authApi';
import { goalsApi } from '../../../../entities/nutrition/api/goalsApi';
import styles from './OnboardingFlow.module.css';

const TOTAL_STEPS = 4;

interface Props {
  defaultName?: string;
}

export function OnboardingFlow({ defaultName = 'Me' }: Props) {
  const profile = useProfileStore();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [name, setName] = useState(defaultName);

  // Step 2 state
  const [sex, setSex] = useState<Sex>(profile.sex);
  const [age, setAge] = useState(profile.age);
  const [heightCm, setHeightCm] = useState(profile.heightCm);
  const [weightKg, setWeightKg] = useState(profile.weightKg);

  // Step 3 state
  const [activity, setActivity] = useState<ActivityLevel>(profile.activity);
  const [goal, setGoal] = useState<GoalKind>(profile.goal);

  // Calculated goals (shown in step 4)
  const suggestedGoals = calculateGoals(weightKg, heightCm, age, sex, activity, goal);

  function finish() {
    const displayName = name.trim() || 'Me';

    // Apply locally first so the UI advances instantly.
    profile.patch({
      displayName,
      sex,
      age,
      heightCm,
      weightKg,
      activity,
      goal,
      goals: { ...suggestedGoals },
      onboardingComplete: true,
    });

    // Persist to the backend (non-blocking — keep local state on error) so the
    // profile + goals survive a fresh login / different browser.
    authApi.update({
      displayName, heightCm, weightKg, age, sex, activityLevel: activity, goal,
    }).catch(() => { /* keep local-only */ });

    goalsApi.save({
      dailyCalories: suggestedGoals.calories,
      proteinGrams:  suggestedGoals.protein,
      carbsGrams:    suggestedGoals.carbs,
      fatGrams:      suggestedGoals.fats,
      fiberGrams:    0,
    }).catch(() => { /* keep local-only */ });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.sheet}>
        <h2 className={styles.title}>Welcome</h2>

        {/* Progress bar */}
        <div className={styles.progress}>
          <div className={styles.progressFill} style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>

        <div className={styles.body}>
          {step === 1 && (
            <StepName name={name} onChange={setName} />
          )}
          {step === 2 && (
            <StepAboutYou
              sex={sex} onSex={setSex}
              age={age} onAge={setAge}
              heightCm={heightCm} onHeight={setHeightCm}
              weightKg={weightKg} onWeight={setWeightKg}
            />
          )}
          {step === 3 && (
            <StepActivityGoal
              activity={activity} onActivity={setActivity}
              goal={goal} onGoal={setGoal}
            />
          )}
          {step === 4 && (
            <StepReview goals={suggestedGoals} />
          )}
        </div>

        <div className={styles.footer}>
          {step > 1 ? (
            <button className={styles.back} onClick={() => setStep(step - 1)}>Back</button>
          ) : (
            <span />
          )}
          {step < TOTAL_STEPS ? (
            <button className={styles.next} onClick={() => setStep(step + 1)} disabled={step === 1 && !name.trim()}>
              Next
            </button>
          ) : (
            <button className={styles.next} onClick={finish}>Finish</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Step 1: Name ── */
function StepName({ name, onChange }: { name: string; onChange: (v: string) => void }) {
  return (
    <div className={styles.step}>
      <h3 className={styles.stepTitle}>What should we call you?</h3>
      <input
        className={styles.nameInput}
        value={name}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Your name"
        autoFocus
        maxLength={40}
      />
    </div>
  );
}

/* ── Step 2: Physical data ── */
interface StepAboutYouProps {
  sex: Sex; onSex: (v: Sex) => void;
  age: number; onAge: (v: number) => void;
  heightCm: number; onHeight: (v: number) => void;
  weightKg: number; onWeight: (v: number) => void;
}

function StepAboutYou({ sex, onSex, age, onAge, heightCm, onHeight, weightKg, onWeight }: StepAboutYouProps) {
  const sexOptions: { value: Sex; label: string }[] = [
    { value: 'female', label: 'Female' },
    { value: 'male', label: 'Male' },
    { value: 'other', label: 'Prefer not to say' },
  ];

  return (
    <div className={styles.step}>
      <p className={styles.sectionLabel}>About you</p>
      <div className={styles.card}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Sex</span>
          <select
            className={styles.select}
            value={sex}
            onChange={(e) => onSex(e.target.value as Sex)}
          >
            {sexOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className={styles.divider} />
        <StepperRow label="Age" value={age} unit="" onChange={onAge} min={10} max={99} step={1} />
        <div className={styles.divider} />
        <StepperRow label="Height" value={heightCm} unit="cm" onChange={onHeight} min={100} max={250} step={1} />
        <div className={styles.divider} />
        <StepperRow label="Weight" value={weightKg} unit="kg" onChange={onWeight} min={30} max={300} step={0.5} decimals={1} />
      </div>
      <p className={styles.hint}>We use these to estimate your daily calorie needs (Mifflin–St Jeor).</p>
    </div>
  );
}

/* ── Step 3: Activity + Goal ── */
interface StepActivityGoalProps {
  activity: ActivityLevel; onActivity: (v: ActivityLevel) => void;
  goal: GoalKind; onGoal: (v: GoalKind) => void;
}

const ACTIVITIES: { value: ActivityLevel; label: string; sub: string }[] = [
  { value: 'sedentary', label: 'Sedentary', sub: 'desk job, little exercise' },
  { value: 'light', label: 'Lightly active', sub: '1–3 sessions/week' },
  { value: 'moderate', label: 'Moderately active', sub: '3–5 sessions/week' },
  { value: 'active', label: 'Active', sub: '6–7 sessions/week' },
  { value: 'veryActive', label: 'Very active', sub: 'twice daily / physical job' },
];

const GOALS: { value: GoalKind; label: string }[] = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain weight' },
];

function StepActivityGoal({ activity, onActivity, goal, onGoal }: StepActivityGoalProps) {
  return (
    <div className={styles.step}>
      <p className={styles.sectionLabel}>Activity level</p>
      <div className={styles.card}>
        {ACTIVITIES.map((a, i) => (
          <div key={a.value}>
            {i > 0 && <div className={styles.divider} />}
            <button
              className={`${styles.optionRow} ${activity === a.value ? styles.optionActive : ''}`}
              onClick={() => onActivity(a.value)}
            >
              <span>
                <span className={styles.optionLabel}>{a.label}</span>
                <span className={styles.optionSub}>({a.sub})</span>
              </span>
              {activity === a.value && <CheckCircle />}
            </button>
          </div>
        ))}
      </div>

      <p className={styles.sectionLabel} style={{ marginTop: 20 }}>Goal</p>
      <div className={styles.card}>
        {GOALS.map((g, i) => (
          <div key={g.value}>
            {i > 0 && <div className={styles.divider} />}
            <button
              className={`${styles.optionRow} ${goal === g.value ? styles.optionActive : ''}`}
              onClick={() => onGoal(g.value)}
            >
              <span className={styles.optionLabel}>{g.label}</span>
              {goal === g.value && <CheckCircle />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Step 4: Review ── */
function StepReview({ goals }: { goals: ReturnType<typeof calculateGoals> }) {
  return (
    <div className={styles.step}>
      <p className={styles.sectionLabel}>Suggested daily goals</p>
      <div className={styles.card}>
        <GoalRow label="Calories" value={`${goals.calories} kcal`} />
        <div className={styles.divider} />
        <GoalRow label="Protein" value={`${goals.protein} g`} />
        <div className={styles.divider} />
        <GoalRow label="Carbs" value={`${goals.carbs} g`} />
        <div className={styles.divider} />
        <GoalRow label="Fats" value={`${goals.fats} g`} />
      </div>
      <p className={styles.hint}>You can fine-tune any of these later from Profile.</p>
    </div>
  );
}

function GoalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  );
}

/* ── Stepper row ── */
interface StepperRowProps {
  label: string; value: number; unit: string;
  onChange: (v: number) => void;
  min: number; max: number; step: number; decimals?: number;
}

function StepperRow({ label, value, unit, onChange, min, max, step, decimals = 0 }: StepperRowProps) {
  function dec() { onChange(Math.max(min, parseFloat((value - step).toFixed(decimals)))); }
  function inc() { onChange(Math.min(max, parseFloat((value + step).toFixed(decimals)))); }

  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={styles.stepper}>
        <span className={styles.stepperVal}>{decimals ? value.toFixed(decimals) : value} {unit}</span>
        <div className={styles.stepperBtns}>
          <button className={styles.stepBtn} onClick={dec} disabled={value <= min}>−</button>
          <div className={styles.stepDivider} />
          <button className={styles.stepBtn} onClick={inc} disabled={value >= max}>+</button>
        </div>
      </div>
    </div>
  );
}

function CheckCircle() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#2563eb" />
      <path d="M7 12.5 10.5 16 17 8.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
