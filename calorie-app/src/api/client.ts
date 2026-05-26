import type { ApiError } from '../types';

// Base URL for the backend.
// In development mode vite.config.ts proxies /api -> http://localhost:8080
const BASE_URL = '/api';

// Read the token from localStorage (stored there after login)
function getToken(): string | null {
  return localStorage.getItem('token');
}

// Generic request function
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // If the body is not FormData, set Content-Type to JSON
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Try to read the error message from the backend
    let errorMessage = `HTTP error: ${response.status}`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.message ?? errorMessage;
    } catch {
      // If JSON parsing fails — keep the default message
    }

    const error: ApiError = {
      message: errorMessage,
      status: response.status,
    };
    throw error;
  }

  // If the response is empty (e.g. 204 No Content) — return null
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (null as T);
}

// Convenience methods
export const apiClient = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
