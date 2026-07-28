import { existsSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow, protocol } from "electron";
import { registerFileDialogHandlers } from "./ipc/file-dialog.js";
import { registerLocalVideoProtocol, registerAppProtocol, LOCAL_VIDEO_SCHEME, APP_SCHEME } from "./protocol.js";
import { registerVideoConvert } from "./video-convert.js";

// Prefer a real PNG logo (drop your brand PNG at resources/icon.png). Falls
// back to Electron's default if it isn't present yet.
function resolveWindowIcon(): string | undefined {
  const candidates = [
    join(__dirname, "../../resources/icon.png"),
    join(process.cwd(), "resources/icon.png"),
  ];
  return candidates.find((p) => existsSync(p));
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: LOCAL_VIDEO_SCHEME,
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, bypassCSP: true },
  },
  {
    // The renderer's own origin in production. `standard` gives it a real tuple
    // origin (app://bundle) that embedded players like YouTube will accept.
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

function createWindow() {
  const icon = resolveWindowIcon();
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#080b16",
    show: false,
    autoHideMenuBar: true,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  // Surface renderer load failures (e.g. a bad app:// asset path) to the main log.
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    if (code === -3) return; // aborted (benign, e.g. redirects)
    console.error(`[renderer] failed to load (${code} ${desc}): ${url}`);
  });

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    // Serve over app:// (not file://) so the renderer has a real origin.
    win.loadURL(`${APP_SCHEME}://bundle/index.html`);
  }
}

app.whenReady().then(() => {
  registerLocalVideoProtocol();
  registerAppProtocol(join(__dirname, "../renderer"));
  registerFileDialogHandlers();
  registerVideoConvert();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
