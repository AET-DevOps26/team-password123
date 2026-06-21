import { useState } from 'react';
import { authApi } from '../api/authApi';
import { useUserStore } from '../../../entities/user';
import { useProfileStore } from '../../../entities/user/model/profile';
import { goalsApi } from '../../../entities/nutrition/api/goalsApi';

export type AuthMode = 'login' | 'register';

interface FormState {
  displayName: string;
  email: string;
  password: string;
  showPassword: boolean;
}

interface FormErrors {
  displayName: string;
  email: string;
  password: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(state: FormState, mode: AuthMode): FormErrors {
  const isReg = mode === 'register';
  return {
    displayName: isReg && !state.displayName.trim() ? 'Tell us what to call you' : '',
    email:       !EMAIL_RE.test(state.email)         ? 'Enter a valid email'      : '',
    password:    state.password.length < 8           ? 'At least 8 characters'    : '',
  };
}

export function useAuthForm() {
  const setSession  = useUserStore((s) => s.setSession);
  const patchProfile = useProfileStore((s) => s.patch);

  const [mode, setMode]       = useState<AuthMode>('login');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    displayName: '',
    email: '',
    password: '',
    showPassword: false,
  });

  const errors  = validate(form, mode);
  const isValid = !errors.email && !errors.password && (mode === 'login' || !errors.displayName);

  function patch(field: Partial<FormState>) {
    setForm((f) => ({ ...f, ...field }));
    setApiError(null);
  }

  function switchMode(next: AuthMode) {
    setMode(next);
    setTouched(false);
    setApiError(null);
  }

  async function submit() {
    setTouched(true);
    if (!isValid || loading) return;

    setLoading(true);
    setApiError(null);

    try {
      const response = mode === 'login'
        ? await authApi.login({ email: form.email.trim(), password: form.password })
        : await authApi.register({
            email:       form.email.trim(),
            password:    form.password,
            displayName: form.displayName.trim(),
          });

      setSession(response.accessToken, {
        id:          String(response.userId),
        email:       response.email,
        displayName: response.displayName,
        createdAt:   response.expiresAt,
      });

      // Hydrate the local profile from the backend (non-blocking). A filled
      // profile (age set) means the user already onboarded — or was seeded — so
      // we mark onboarding complete and skip the wizard. Never downgrades:
      // missing fields are left at their local defaults.
      authApi.me().then((me) => {
        if (me && me.age != null) {
          patchProfile({
            displayName: me.displayName,
            ...(me.heightCm      != null ? { heightCm: me.heightCm }            : {}),
            ...(me.weightKg      != null ? { weightKg: Number(me.weightKg) }    : {}),
            age: me.age,
            ...(me.sex           ? { sex: me.sex }              : {}),
            ...(me.activityLevel ? { activity: me.activityLevel } : {}),
            ...(me.goal          ? { goal: me.goal }            : {}),
            onboardingComplete: true,
          });
        }
      }).catch(() => { /* keep local defaults */ });

      // Load server-side goals (non-blocking — ignore errors). This runs in
      // parallel with me() above but only patches `goals`, never
      // `onboardingComplete`, so the two resolving in any order is safe (the
      // onboarding gate depends solely on the value me() sets).
      goalsApi.get().then((g) => {
        if (g) {
          patchProfile({
            goals: {
              calories: Math.round(Number(g.dailyCalories)),
              protein:  Math.round(Number(g.proteinGrams)),
              carbs:    Math.round(Number(g.carbsGrams)),
              fats:     Math.round(Number(g.fatGrams)),
              water:    useProfileStore.getState().goals.water,
            },
          });
        }
      }).catch(() => { /* keep local defaults */ });
    } catch (err) {
      const msg = (err as { message?: string }).message ?? 'Something went wrong. Please try again.';
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  }

  return {
    mode, switchMode,
    form, patch,
    errors: touched ? errors : { displayName: '', email: '', password: '' },
    apiError,
    isValid,
    loading,
    submit,
  };
}
