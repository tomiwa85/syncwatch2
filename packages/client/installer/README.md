# SyncWatch installer (NSIS)

Builds a single-file Windows wizard installer (`SyncWatch-Setup-1.0.0.exe`) with the
classic Welcome → License → Install location → Install → Finish pages. It installs
**per-user** (no administrator rights needed), creates Desktop + Start Menu shortcuts,
and registers a proper uninstaller in Add/Remove Programs.

An Electron app is self-contained, so the installer bundles everything the app needs —
there is nothing else for the user to download or install.

## Files
- `installer.nsi` — the NSIS script (MUI2 wizard, per-user install, shortcuts, uninstaller).
- `LICENSE.txt` — shown on the License page.
- `appicon.ico` — installer icon (the SyncWatch logo).

## Rebuild it
1. Rebuild the app first so `release/win-unpacked/` is current:
   ```bash
   pnpm --filter @syncwatch/client build
   # then repack app.asar into win-unpacked (see DISTRIBUTION.md) OR run electron-builder
   ```
2. Compile the installer with NSIS (`makensis`):
   ```powershell
   & "<path-to>\makensis.exe" "packages\client\installer\installer.nsi"
   ```
   Output: `packages/client/release/SyncWatch-Setup-1.0.0.exe`.

`makensis` came from the electron-builder NSIS bundle
(`electron-builder-binaries` release `nsis-3.0.4.2`); any NSIS 3.x `makensis` works.

## Why not `electron-builder --win`?
electron-builder downloads a `winCodeSign` bundle (for code signing) that contains
macOS symlinks; extracting those on Windows needs Developer Mode / admin, which the
build machine lacked. Compiling the NSIS script directly sidesteps that entirely and
produces the same kind of installer.
