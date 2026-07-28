import { env } from "./env.js";

// CORS_ORIGIN may be a comma-separated list of allowed browser origins.
const allowed = env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);

// The Android (Capacitor) app serves its UI from a localhost/capacitor scheme,
// so its requests carry one of these origins.
const mobileOrigins = new Set([
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
  "ionic://localhost",
]);

/**
 * Whether a request origin is allowed.
 * - The packaged Electron app serves its renderer from the `app://` scheme.
 * - The Android (Capacitor) app uses a localhost/capacitor scheme origin.
 * - Browser (dev/web) requests are matched against the configured allow-list.
 * The API is authenticated with JWTs (no cookies), so this only governs which
 * browser origins may call it.
 */
export function isAllowedOrigin(origin?: string): boolean {
  if (!origin || origin === "null") return true;
  // The desktop app's own renderer origin (app://bundle).
  if (origin.startsWith("app://")) return true;
  if (mobileOrigins.has(origin)) return true;
  return allowed.includes(origin);
}
