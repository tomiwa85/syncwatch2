import { io, type Socket } from "socket.io-client";
import { getSocketUrl } from "../config.js";
import { forceRefresh } from "../api/http.js";
import { useAuthStore } from "../state/auth.store.js";

let socket: Socket | null = null;
let refreshing = false;

/** Lazily create (or return) the shared Socket.IO connection. Auth is a callback
 *  so each (re)connect uses the latest access token — surviving token rotation. */
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(getSocketUrl(), {
    autoConnect: false,
    // Prefer WebSocket (fast) but fall back to HTTP long-polling — many mobile
    // networks/proxies block or slow the raw WebSocket upgrade, and without a
    // fallback the connection would stall instead of degrading gracefully.
    transports: ["websocket", "polling"],
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken ?? "" }),
  });

  // If a connection is rejected (likely an expired access token), refresh once
  // and retry. If the refresh itself fails it clears the session → login screen.
  socket.on("connect_error", async () => {
    if (refreshing) return;
    refreshing = true;
    try {
      if (await forceRefresh()) socket?.connect();
    } finally {
      refreshing = false;
    }
  });

  // Android pauses the app while you're in the file picker or another app, the
  // connection drops, and socket.io then sits out its retry back-off. When the
  // app comes back to the front mid-reconnect, retry immediately instead.
  // (`active` is false after a deliberate disconnect, e.g. sign-out.)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && socket?.active && !socket.connected) {
      socket.disconnect().connect();
    }
  });

  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
