// Single seam for backend location. In dev these point at the local server;
// production builds inject the deployed URL at build time.
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
}

/** Which build this is — shown on the splash and lobby so it's easy to confirm
 *  a phone is running the latest APK. */
export const BUILD_LABEL = import.meta.env.VITE_BUILD_LABEL ?? "Local build";

export function getSocketUrl(): string {
  return import.meta.env.VITE_SOCKET_URL ?? "http://localhost:4000";
}
