import { env } from "./env.js";

// CORS_ORIGIN may be a comma-separated list of allowed browser origins.
const allowed = env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);

/**
 * Whether a request origin is allowed.
 * The packaged Electron app loads its UI from `file://`, so its Origin is
 * `null` (or absent) — desktop requests must be allowed. Browser (dev/web)
 * requests are matched against the configured allow-list.
 */
export function isAllowedOrigin(origin?: string): boolean {
  if (!origin || origin === "null") return true;
  return allowed.includes(origin);
}
