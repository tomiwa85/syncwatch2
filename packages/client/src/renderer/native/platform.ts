import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

/** True inside the Android (Capacitor) app; false in Electron / a browser. */
export const isNative = Capacitor.isNativePlatform();

/** Touch-first device (phone/tablet) — where tilt-to-fullscreen and tap gestures apply. */
export const isTouchDevice =
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;

/** A phone specifically (not a tablet, which lives in landscape anyway) — where
 *  tilting sideways should mean "go fullscreen". */
export const isPhone =
  isTouchDevice && typeof screen !== "undefined" && Math.min(screen.width, screen.height) < 600;

/** Match the Android status bar to the app theme so it doesn't look bolted on. */
export function syncStatusBar(theme: "dark" | "light"): void {
  if (!isNative) return;
  const dark = theme === "dark";
  // Style.Dark = light icons for a dark background.
  void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
  void StatusBar.setBackgroundColor({ color: dark ? "#080B16" : "#EEF0F8" }).catch(() => {});
}

/** Hide/show the status bar (used for immersive video). */
export function setStatusBarHidden(hidden: boolean): void {
  if (!isNative) return;
  void (hidden ? StatusBar.hide() : StatusBar.show()).catch(() => {});
}

/** Tiny localStorage wrapper that never throws (private mode, blocked storage). */
export const prefs = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
};
