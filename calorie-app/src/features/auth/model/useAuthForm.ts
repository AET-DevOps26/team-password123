import { useState } from 'react';
import { authApi } from '../api/authApi';
import { useUserStore } from '../../../entities/user';
import { useProfileStore } from '../../../entities/user/model/profile';
import { goalsApi } from '../../../entities/nutrition/api/goalsApi';
import { MOCK_MODE } from '../../../shared/config/flags';

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

      // Sync the profile name (the single source of truth for the greeting and
      // sidebar) to the freshly-authenticated account. Always set it so a
      // sign-out + different-account login on the same device can't leave the
      // previous user's name on screen. For a brand-new account, onboarding
      // runs next and overwrites this with whatever name the user enters.
      patchProfile({ displayName: response.displayName });

      // Load server-side goals (non-blocking — ignore errors)
      if (!MOCK_MODE) {
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
      }
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
