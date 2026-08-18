// JWT token management — replaces @supabase/supabase-js auth

export interface AuthUser {
  id: string;
  email: string;
  role: "user" | "superadmin";
}

const TOKEN_KEY = "eduhub_token";
const USER_KEY  = "eduhub_user";

export const API_BASE = import.meta.env.VITE_API_URL || "/api";

export const getToken = (): string | null =>
  typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

export const getStoredUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

export const setAuth = (token: string, user: AuthUser): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export interface ApiResult<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const json = await res.json().catch(() => null);
    if (res.status === 401) {
      const serverMsg = (json as Record<string, string> | null)?.message;
      // Only treat as "session expired" when we had a token that got rejected (authenticated call)
      if (token) {
        clearAuth();
        return { data: null, error: { message: serverMsg || "Session expired. Please log in again." } };
      }
      return { data: null, error: { message: serverMsg || "Invalid email or password." } };
    }
    if (!res.ok) {
      return { data: null, error: { message: (json as Record<string, string> | null)?.message || res.statusText } };
    }
    if (json === null) {
      return { data: null, error: { message: "Invalid response from server" } };
    }
    return { data: json as T, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { data: null, error: { message: msg } };
  }
}
