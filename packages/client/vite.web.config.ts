import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone web build for the Android (Capacitor) app. Reuses the exact same
// React renderer as the desktop app; only the packaging differs. The backend
// URLs are baked in here (public URL, not a secret) so the mobile build always
// points at the hosted server.
const BACKEND_URL = "https://syncwatch-server-szu2.onrender.com";

// App version shown on the splash + lobby: "v1.<CI build number>" (e.g. v1.28).
// The Android workflow stamps the same number into the APK's versionName, so
// the app and Android's app info always agree. Local builds say "dev".
const BUILD_LABEL = process.env.GITHUB_RUN_NUMBER ? `v1.${process.env.GITHUB_RUN_NUMBER}` : "dev";

export default defineConfig({
  root: resolve(__dirname, "src/renderer"),
  base: "./",
  plugins: [react()],
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(BACKEND_URL),
    "import.meta.env.VITE_SOCKET_URL": JSON.stringify(BACKEND_URL),
    "import.meta.env.VITE_BUILD_LABEL": JSON.stringify(BUILD_LABEL),
  },
  build: {
    outDir: resolve(__dirname, "dist-web"),
    emptyOutDir: true,
  },
});
