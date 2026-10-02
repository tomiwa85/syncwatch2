/**
 * Render's free plan stops this server after 15 minutes without incoming
 * requests; the next visitor then waits ~40s for it to boot (the "slow first
 * sign-in"). A request to our own PUBLIC url goes out through Render's edge and
 * back in, so it counts as incoming traffic — the process keeps itself awake.
 *
 * It hits /api/ping, which does not touch the database (keeping Neon awake
 * 24/7 would use up its free compute allowance).
 *
 * Render sets RENDER_EXTERNAL_URL automatically. Locally it's unset, so this is
 * off unless KEEP_ALIVE_URL is given (KEEP_ALIVE_INTERVAL_MS is for testing).
 */
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000; // comfortably inside the 15-minute idle limit

export function startKeepAlive(log: (msg: string) => void): void {
  const base = process.env.KEEP_ALIVE_URL ?? process.env.RENDER_EXTERNAL_URL;
  if (!base) return;
  const url = `${base.replace(/\/+$/, "")}/api/ping`;
  const intervalMs = Number(process.env.KEEP_ALIVE_INTERVAL_MS) || DEFAULT_INTERVAL_MS;

  const timer = setInterval(() => {
    fetch(url, { signal: AbortSignal.timeout(30_000) })
      .then((res) => {
        if (!res.ok) log(`keep-alive ping got HTTP ${res.status}`);
      })
      .catch((err: unknown) => log(`keep-alive ping failed: ${err instanceof Error ? err.message : String(err)}`));
  }, intervalMs);
  timer.unref(); // never the reason the process stays alive

  log(`keep-alive: pinging ${url} every ${Math.round(intervalMs / 1000)}s`);
}
