import { create } from 'zustand';
import type { UserResponse } from './types';

interface UserSession {
  token: string | null;
  user: UserResponse | null;
}

interface UserStore extends UserSession {
  setSession: (token: string, user: UserResponse) => void;
  clearSession: () => void;
}

function loadSession(): UserSession {
  try {
    const token = localStorage.getItem('token');
    const raw   = localStorage.getItem('user');
    const user  = raw ? (JSON.parse(raw) as UserResponse) : null;
    return token && user ? { token, user } : { token: null, user: null };
  } catch {
    return { token: null, user: null };
  }
}

export const useUserStore = create<UserStore>((set) => ({
  ...loadSession(),

  setSession(token, user) {
    try {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    } catch { /* ignore */ }
    set({ token, user });
  },

  clearSession() {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch { /* ignore */ }
    set({ token: null, user: null });
  },
}));
