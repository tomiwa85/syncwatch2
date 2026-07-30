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
