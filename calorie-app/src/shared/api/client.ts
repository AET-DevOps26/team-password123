import type { ApiError } from '../lib/types';
import { OFFLINE_MODE } from '../config/flags';

const BASE_URL = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

// Fake responses for OFFLINE_MODE — mirrors real backend shapes so the app
// renders an empty-state experience without any network errors.
function offlineResponse<T>(path: string, method: string): T {
  if (
    (path === '/auth/login' || path === '/auth/register') &&
    method === 'POST'
  ) {
    return {
      token: 'offline',
      user: {
        id: 'offline',
        email: 'guest@local',
        displayName: 'Guest User',
        createdAt: new Date().toISOString(),
      },
    } as T;
  }
  // GET /meals list
  if (path === '/meals' && method === 'GET') return [] as T;
  return null as T;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (OFFLINE_MODE) {
    return offlineResponse<T>(path, options.method ?? 'GET');
  }

  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    let errorMessage = `HTTP error: ${response.status}`;
    try {
      const body = await response.json();
      errorMessage = body.message ?? errorMessage;
    } catch { /* keep default */ }

    const error: ApiError = { message: errorMessage, status: response.status };
    throw error;
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (null as T);
}

export const apiClient = {
  get:    <T>(path: string)                => request<T>(path),
  post:   <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST',   body: body instanceof FormData ? body : JSON.stringify(body) }),
  put:    <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)                => request<T>(path, { method: 'DELETE' }),
};
