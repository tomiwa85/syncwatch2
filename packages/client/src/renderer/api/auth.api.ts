import type { AuthResponse, LoginRequest, SignupRequest } from "@syncwatch/shared";
import { apiRequest } from "./http.js";
import { useAuthStore } from "../state/auth.store.js";
import { disconnectSocket } from "../realtime/socket-client.js";

export function signup(input: SignupRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/signup", { method: "POST", body: input, auth: false });
}

export function login(input: LoginRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/login", { method: "POST", body: input, auth: false });
}

/**
 * Sign out instantly: drop the session and realtime connection locally right
 * away, then revoke the refresh token on the server in the background. The user
 * never waits on the network (which could be a sleeping server) to leave.
 */
export function logout(): void {
  const { refreshToken } = useAuthStore.getState();
  disconnectSocket();
  useAuthStore.getState().clear();
  if (refreshToken) {
    void apiRequest<void>("/api/auth/logout", { method: "POST", body: { refreshToken }, auth: false }).catch(() => {
      /* best-effort; the session is already gone locally */
    });
  }
}
