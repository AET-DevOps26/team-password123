import { useAuthForm } from '../../model/useAuthForm';
import styles from './AuthPage.module.css';

export function AuthPage() {
  const auth = useAuthForm();
  const isReg = auth.mode === 'register';

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') auth.submit();
  }

  return (
    <div className={styles.overlay}>
      {/* ── Left: brand panel (desktop) ── */}
      <aside className={styles.brand}>
        <div className={styles.brandInner}>
          <div className={styles.brandMark}>
            <FlameIcon />
            <span className={styles.brandName}>calorie<b>easy</b></span>
          </div>
          <h2 className={styles.tagline}>Know what's on your plate — in one snap.</h2>
          <ul className={styles.points}>
            <li><span className={styles.tick}><CheckIcon /></span>Photograph a meal, skip the manual data entry</li>
            <li><span className={styles.tick}><CheckIcon /></span>AI estimates calories &amp; macros instantly</li>
            <li><span className={styles.tick}><CheckIcon /></span>Watch your trends across weeks and months</li>
          </ul>
          <div className={styles.appShot}>
            <span className={styles.appShotCap}>app preview</span>
          </div>
        </div>
      </aside>

      {/* ── Right: form ── */}
      <main className={styles.formWrap}>
        <div className={styles.form} onKeyDown={handleKeyDown}>

          {/* Mobile-only brand */}
          <div className={styles.mobileBrand}>
            <FlameIcon />
            <span className={styles.brandName}>calorie<b>easy</b></span>
          </div>

          <h1 className={styles.title}>
            {isReg ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className={styles.sub}>
            {isReg ? 'Start tracking in under a minute.' : 'Sign in to pick up where you left off.'}
          </p>

          {/* Mode tabs */}
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${!isReg ? styles.tabActive : ''}`}
              onClick={() => auth.switchMode('login')}
              aria-label="Switch to sign in"
            >
              Sign in
            </button>
            <button
              type="button"
              className={`${styles.tab} ${isReg ? styles.tabActive : ''}`}
              onClick={() => auth.switchMode('register')}
              aria-label="Switch to create account"
            >
              Create account
            </button>
          </div>

          {/* Fields */}
          <div className={styles.fields}>
            {isReg && (
              <FormField
                label="Display name"
                type="text"
                value={auth.form.displayName}
                onChange={(v) => auth.patch({ displayName: v })}
                placeholder="e.g. Mia"
                error={auth.errors.displayName}
                autoFocus
              />
            )}
            <FormField
              label="Email"
              type="email"
              value={auth.form.email}
              onChange={(v) => auth.patch({ email: v })}
              placeholder="you@email.com"
              error={auth.errors.email}
              autoFocus={!isReg}
            />
            <FormField
              label="Password"
              type={auth.form.showPassword ? 'text' : 'password'}
              value={auth.form.password}
              onChange={(v) => auth.patch({ password: v })}
              placeholder={isReg ? 'Create a password (min 8 chars)' : 'Your password'}
              error={auth.errors.password}
              right={
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => auth.patch({ showPassword: !auth.form.showPassword })}
                >
                  {auth.form.showPassword ? 'Hide' : 'Show'}
                </button>
              }
            />
          </div>

          {/* API error */}
          {auth.apiError && (
            <div className={styles.apiError}>{auth.apiError}</div>
          )}

          {/* Submit */}
          <button
            className={`${styles.submit} ${auth.loading ? styles.loading : ''}`}
            onClick={auth.submit}
            disabled={auth.loading}
          >
            {auth.loading
              ? <span className={styles.spinner} />
              : (isReg ? 'Create account' : 'Sign in')}
          </button>

          <p className={styles.switchLine}>
            {isReg ? 'Already have an account? ' : 'New to calorieasy? '}
            <button onClick={() => auth.switchMode(isReg ? 'login' : 'register')}>
              {isReg ? 'Sign in' : 'Create one'}
            </button>
          </p>

          {isReg && (
            <p className={styles.legal}>
              By continuing you agree to our Terms &amp; Privacy Policy.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

/* ── Field component ── */
interface FormFieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  right?: React.ReactNode;
  autoFocus?: boolean;
}

function FormField({ label, type, value, onChange, placeholder, error, right, autoFocus }: FormFieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={`${styles.inputWrap} ${error ? styles.inputErr : ''}`}>
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={styles.input}
          onChange={(e) => onChange(e.target.value)}
        />
        {right}
      </div>
      {error && <span className={styles.fieldError}>{error}</span>}
    </label>
  );
}

/* ── Icons ── */
function FlameIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c0-1 0-1.5-.5-2.5C16 9 18 12 18 14.5A6 6 0 0 1 6 14.5C6 10 10 8 12 3z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5 10 17.5 19 6.5" />
    </svg>
  );
}
