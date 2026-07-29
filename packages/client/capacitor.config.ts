import type { CapacitorConfig } from "@capacitor/cli";

// SyncWatch Android (Capacitor) — wraps the same React web app in a native
// WebView and talks to the same hosted backend as the desktop app.
const config: CapacitorConfig = {
  appId: "com.syncwatch.app",
  appName: "SyncWatch",
  // The web build output (produced by `pnpm build:web`).
  webDir: "dist-web",
  server: {
    // Serve the app from https://localhost inside the WebView. That origin is
    // already allow-listed by the backend CORS (mobileOrigins), so REST +
    // Socket.IO to Render work without extra config.
    androidScheme: "https",
  },
};

export default config;
