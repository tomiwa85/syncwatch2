import type { RefreshResponse } from "@syncwatch/shared";
import { getApiBaseUrl } from "../config.js";
import { useAuthStore } from "../state/auth.store.js";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Attach the access token and attempt a refresh on 401. Default true. */
  auth?: boolean;
}

async function rawFetch(path: string, method: string, body: unknown, token: string | null): Promise<Response> {
  const hasBody = body !== undefined;
  return fetch(getApiBaseUrl() + path, {
    method,
    headers: {
      // Only advertise a JSON body when we actually send one — Fastify rejects
      // an empty body when content-type is application/json.
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });
}

// Single-flight refresh: concurrent 401s share one refresh request.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const { refreshToken } = useAuthStore.getState();
    if (!refreshToken) return false;
    try {
      const res = await rawFetch("/api/auth/refresh", "POST", { refreshToken }, null);
      if (!res.ok) {
        useAuthStore.getState().clear();
        return false;
      }
      const data = (await res.json()) as RefreshResponse;
      useAuthStore.getState().setTokens(data);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Force a token refresh (single-flight). Returns true on success. */
export function forceRefresh(): Promise<boolean> {
  return refreshTokens();
}

async function toError(res: Response): Promise<ApiError> {
  let message = res.statusText || "Request failed";
  try {
    const data = await res.json();
    if (data && typeof data.message === "string") message = data.message;
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(res.status, message);
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const token = auth ? useAuthStore.getState().accessToken : null;

  let res = await rawFetch(path, method, body, token);

  if (res.status === 401 && auth) {
    const ok = await refreshTokens();
    if (ok) {
      res = await rawFetch(path, method, body, useAuthStore.getState().accessToken);
    }
  }

  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
