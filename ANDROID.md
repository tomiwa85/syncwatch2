# SyncWatch Android app

The Android app is the same React app as the desktop client, wrapped in a native
Android shell with [Capacitor](https://capacitorjs.com/). It talks to the **same
hosted backend** (Render) as the desktop app, so accounts, rooms, chat, and
streaming all work across desktop and phone.

## How the APK is built (in the cloud — no Android tools needed on your PC)

A GitHub Actions workflow (`.github/workflows/android.yml`) builds the APK for
you whenever you push to the repo:

1. Upload the project to GitHub (same as you do for the server).
2. Go to the repo's **Actions** tab → the **Build Android APK** run.
3. When it finishes (green check), open the run and download the
   **`SyncWatch-android-debug`** artifact — inside is `app-debug.apk`.
4. Copy that `.apk` to an Android phone and open it to install. (You'll need to
   allow "Install unknown apps" for your file manager/browser the first time.)

You can also trigger a build manually: **Actions → Build Android APK → Run workflow**.

## What works on Android

- Sign up / sign in, create & join rooms (public/private + passwords), search by ID
- Real-time playback sync, chat, host controls, subtitles
- **Streaming links (YouTube, etc.)** — play in sync
- **Local files**: picks a file from the phone and plays formats the phone's
  browser engine supports (MP4/WebM). Unlike desktop, the phone can't convert
  MKV/AVI (no bundled ffmpeg), so those won't play on Android for now.

## Notes

- App id: `com.syncwatch.app`, name: **SyncWatch**.
- The build is an unsigned **debug** APK — fine for sharing/sideloading. A signed
  release build (for the Play Store) is a later step.
- The native `android/` project and `dist-web/` are generated during the build
  and are not committed (they're in `.gitignore`).

## Building locally (optional, needs Android Studio / SDK)

```bash
pnpm --filter @syncwatch/client build:web
cd packages/client
npx cap add android      # first time only
npx cap sync android
cd android && ./gradlew assembleDebug
# APK: packages/client/android/app/build/outputs/apk/debug/app-debug.apk
```
