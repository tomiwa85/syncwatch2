import type { AuthResponse, LoginRequest, SignupRequest } from "@syncwatch/shared";
import { apiRequest } from "./http.js";
import { useAuthStore } from "../state/auth.store.js";

export function signup(input: SignupRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/signup", { method: "POST", body: input, auth: false });
}

export function login(input: LoginRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/login", { method: "POST", body: input, auth: false });
}

export async function logout(): Promise<void> {
  const { refreshToken } = useAuthStore.getState();
  if (refreshToken) {
    try {
      await apiRequest<void>("/api/auth/logout", { method: "POST", body: { refreshToken }, auth: false });
    } catch {
      /* best-effort; clear locally regardless */
    }
  }
  useAuthStore.getState().clear();
}
