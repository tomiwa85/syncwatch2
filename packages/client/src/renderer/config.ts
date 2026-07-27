// Single seam for backend location. In dev these point at the local server;
// production builds inject the deployed URL at build time.
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
}

export function getSocketUrl(): string {
  return import.meta.env.VITE_SOCKET_URL ?? "http://localhost:4000";
}
