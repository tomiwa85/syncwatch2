# App icons

- `icon.png` — the exact SyncWatch brand artwork. The Electron window/taskbar
  icon uses it automatically. This is the same file rendered in-app via `<Logo />`
  (from `src/renderer/assets/logo-full.png`).
- `logo-full.png` — copy of the full brand lockup (mark + wordmark + tagline).

For a packaged installer later (electron-builder), we'll generate platform
icons from this PNG:
- Windows: `icon.ico`
- macOS: `icon.icns`
- Linux: `icon.png`
