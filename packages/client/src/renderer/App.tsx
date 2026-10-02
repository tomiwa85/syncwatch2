import { useEffect, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { ThemeProvider } from "./design-system/ThemeProvider.js";
import { ToastProvider } from "./design-system/components/Toast.js";
import { ConfirmProvider } from "./design-system/useConfirm.js";
import { AuthScreen } from "./screens/AuthScreen.js";
import { LobbyScreen } from "./screens/LobbyScreen.js";
import { RoomScreen } from "./screens/RoomScreen.js";
import { HistoryScreen } from "./screens/HistoryScreen.js";
import { MyRoomsScreen } from "./screens/MyRoomsScreen.js";
import { SplashScreen } from "./components/SplashScreen.js";
import { useAuthStore } from "./state/auth.store.js";
import { useNavStore } from "./state/nav.store.js";
import { dispatchBack } from "./native/back-button.js";
import { isNative } from "./native/platform.js";

function Router() {
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken && s.user));
  const route = useNavStore((s) => s.route);

  if (!isAuthenticated) return <AuthScreen />;
  if (route.name === "room") return <RoomScreen />;
  if (route.name === "history") return <HistoryScreen />;
  if (route.name === "myRooms") return <MyRoomsScreen />;
  return <LobbyScreen />;
}

/** Thin banner when the device loses its connection, so the app never just looks frozen. */
function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[90] bg-danger px-4 py-1.5 text-center text-xs font-medium text-white"
    >
      You're offline — we'll reconnect as soon as your connection is back.
    </div>
  );
}

/**
 * Android Back: let whatever is open (dialog, fullscreen video, chat) handle it
 * first; otherwise step back to the lobby; from the lobby, send the app to the
 * background (like any Android app) instead of killing it.
 */
function useAndroidBack() {
  useEffect(() => {
    if (!isNative) return;
    const listener = CapApp.addListener("backButton", () => {
      if (dispatchBack()) return;
      const nav = useNavStore.getState();
      const signedIn = Boolean(useAuthStore.getState().accessToken);
      if (signedIn && nav.route.name !== "lobby") {
        nav.goToLobby();
        return;
      }
      void CapApp.minimizeApp();
    });
    return () => {
      void listener.then((l) => l.remove());
    };
  }, []);
}

export function App() {
  const [splashDone, setSplashDone] = useState(false);
  useAndroidBack();
  return (
    <ThemeProvider defaultTheme="dark">
      <ToastProvider>
        <ConfirmProvider>
          <Router />
          <OfflineBanner />
          {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
