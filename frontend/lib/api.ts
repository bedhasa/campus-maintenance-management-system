type ApiError = {
  message?: string;
  errors?: Record<string, string[]>;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://192.168.137.13:8000";
const REQUEST_TIMEOUT_MS = 15000;

export function readAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const sessionToken = sessionStorage.getItem("auth_token");
  if (sessionToken) return sessionToken;

  // Backward compatibility: migrate old localStorage token to sessionStorage.
  const legacyToken = localStorage.getItem("auth_token");
  if (legacyToken) {
    sessionStorage.setItem("auth_token", legacyToken);
    localStorage.removeItem("auth_token");
    return legacyToken;
  }

  return null;
}

export function writeAuthToken(token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("auth_token", token);
  localStorage.removeItem("auth_token");
  window.dispatchEvent(new Event("auth-state-changed"));
}

export function writeAuthUser(user: unknown) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("auth_user", JSON.stringify(user));
  localStorage.removeItem("auth_user");
  window.dispatchEvent(new Event("auth-user-updated"));
}

export function readAuthUser<T = unknown>(): T | null {
  if (typeof window === "undefined") return null;
  const parse = (raw: string | null): T | null => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  };
  const sessionUser = parse(sessionStorage.getItem("auth_user"));
  if (sessionUser) return sessionUser;

  // Backward compatibility: migrate old localStorage user to sessionStorage.
  const legacyUser = localStorage.getItem("auth_user");
  const parsedLegacyUser = parse(legacyUser);
  if (legacyUser && parsedLegacyUser) {
    sessionStorage.setItem("auth_user", legacyUser);
    localStorage.removeItem("auth_user");
    return parsedLegacyUser;
  }

  return null;
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("auth_token");
  sessionStorage.removeItem("auth_user");
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
  localStorage.removeItem("user");
  window.dispatchEvent(new Event("auth-state-changed"));
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  includeAuth = false
): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set("Accept", "application/json");

  if (includeAuth) {
    const token = readAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw new Error("Unable to reach the server. Please check your connection and try again.");
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error("Server error. Please try again in a moment.");
    }
    if (response.status === 401) {
      clearAuth();
      throw new Error("Your session has expired. Please sign in again.");
    }
    const error = (payload ?? {}) as ApiError;
    const fallback = "Request failed. Please try again.";
    const message = error.message ?? Object.values(error.errors ?? {}).flat()[0] ?? fallback;
    if (response.status === 403) {
      throw new Error(message || "You are not authorized to perform this action.");
    }
    throw new Error(message);
  }

  return payload as T;
}
