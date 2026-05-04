import { getAuth } from 'firebase/auth';

// Single source of truth for the API base URL. All other code calls
// `apiUrl(path)` instead of constructing it inline, so prod/dev parity is
// guaranteed and we can swap in a different base for tests.
function resolveApiBase(): string {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  if (typeof window !== 'undefined' && window.location.origin) return window.location.origin;
  return 'http://localhost:3001';
}

export function apiUrl(path: string): string {
  const base = resolveApiBase().replace(/\/$/, '');
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  json?: unknown;
  headers?: Record<string, string>;
  /** When true, attaches a Firebase Bearer token. Throws if no user is signed in. */
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, auth, headers: callerHeaders, ...rest } = options;
  const headers: Record<string, string> = { ...(callerHeaders || {}) };

  let body: BodyInit | undefined;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }

  if (auth) {
    const user = getAuth().currentUser;
    if (!user) throw new ApiError('Not authenticated', 401, null);
    const token = await user.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl(path), { ...rest, headers, body });
  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    const message =
      (parsed && typeof parsed === 'object' && 'message' in parsed && typeof (parsed as { message: unknown }).message === 'string'
        ? (parsed as { message: string }).message
        : null) ||
      response.statusText ||
      `Request failed (${response.status})`;
    throw new ApiError(message, response.status, parsed);
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, json?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', json }),
  put: <T>(path: string, json?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PUT', json }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};
