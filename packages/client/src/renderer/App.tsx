import { useState } from "react";
import { ThemeProvider } from "./design-system/ThemeProvider.js";
import { ToastProvider } from "./design-system/components/Toast.js";
import { ConfirmProvider } from "./design-system/useConfirm.js";
import { AuthScreen } from "./screens/AuthScreen.js";
import { LobbyScreen } from "./screens/LobbyScreen.js";
import { RoomScreen } from "./screens/RoomScreen.js";
import { HistoryScreen } from "./screens/HistoryScreen.js";
import { SplashScreen } from "./components/SplashScreen.js";
import { useAuthStore } from "./state/auth.store.js";
import { useNavStore } from "./state/nav.store.js";

function Router() {
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken && s.user));
  const route = useNavStore((s) => s.route);

  if (!isAuthenticated) return <AuthScreen />;
  if (route.name === "room") return <RoomScreen />;
  if (route.name === "history") return <HistoryScreen />;
  return <LobbyScreen />;
}

export function App() {
  const [splashDone, setSplashDone] = useState(false);
  return (
    <ThemeProvider defaultTheme="dark">
      <ToastProvider>
        <ConfirmProvider>
          <Router />
          {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
