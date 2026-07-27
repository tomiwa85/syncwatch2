# Packaging SyncWatch for distribution

The desktop client is packaged with **electron-builder** (config: `electron-builder.yml`).
The renderer, main, and preload are fully bundled by `electron-vite`, so the packaged
app carries no runtime `node_modules` — just the built `out/` inside `app.asar`.

## Output

Build artifacts land in `packages/client/release/`:

- `win-unpacked/` — the ready-to-run app (`SyncWatch.exe` + Electron runtime). Verified: launches cleanly.
- `SyncWatch-1.0.0-win-x64-portable.zip` — **portable distributable**. Unzip anywhere and run `SyncWatch.exe`. No install, no admin.

## Build commands

```bash
# from packages/client
pnpm build                      # electron-vite build -> out/
pnpm dist                       # + electron-builder --win  (NSIS installer — see caveat)
```

Portable zip (what we ship here) is produced from `win-unpacked`:

```powershell
Compress-Archive -Path release\win-unpacked\* `
  -DestinationPath release\SyncWatch-1.0.0-win-x64-portable.zip -CompressionLevel Optimal
```

## Caveat: the NSIS installer needs Developer Mode (or admin) on Windows

`electron-builder` downloads its `winCodeSign` bundle (used for code-signing) which
contains macOS symlinks. Extracting those on Windows requires the *"Create symbolic
links"* privilege, i.e. **Developer Mode** enabled or running as **Administrator**.
Without it the NSIS/installer step fails with:

> ERROR: Cannot create symbolic link : A required privilege is not held by the client

This does **not** affect the app itself — `win-unpacked` (and the portable zip) build
and run fine. To produce the `.exe` installer:

1. Enable **Settings → Privacy & security → For developers → Developer Mode**
   (or run the terminal as Administrator).
2. `pnpm dist` → `release/SyncWatch Setup 1.0.0.exe`.

Code signing (optional, avoids SmartScreen warnings) needs a real certificate via
`CSC_LINK` / `CSC_KEY_PASSWORD`.

## Important: point the app at your deployed backend

The build reads `VITE_API_BASE_URL` / `VITE_SOCKET_URL` (see `packages/client/.env`),
which currently point at `http://localhost:4000` — the local dev server. For a real
distribution, set those to your **deployed backend URL** before `pnpm build`, and
update the `connect-src` in `src/renderer/index.html`'s CSP to allow that origin.
The backend (`packages/server`) is containerizable — deploy it to Railway/Fly/Render
with your Neon Postgres.

## macOS / Linux

`electron-builder.yml` includes `dmg` (mac) and `AppImage` (linux) targets. Build each
on its matching OS (`electron-builder --mac` / `--linux`). Icons are generated from
`build/icon.png`.
