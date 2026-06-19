import type { ApiError } from '../lib/types';

const BASE_URL = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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

/**
 * Fetch a protected binary resource (e.g. a meal photo) with the auth header and
 * return an object URL ready for an <img src>. Returns null on any error, so
 * callers can fall back to a placeholder. The caller owns the returned URL and
 * must URL.revokeObjectURL it when done.
 */
export async function fetchBlobUrl(url: string): Promise<string | null> {
  const token = getToken();
  try {
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) return null;
    return URL.createObjectURL(await response.blob());
  } catch {
    return null;
  }
}

export const apiClient = {
  get:    <T>(path: string)                => request<T>(path),
  post:   <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST',   body: body instanceof FormData ? body : JSON.stringify(body) }),
  put:    <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)                => request<T>(path, { method: 'DELETE' }),
};
