import { create } from "zustand";
import type { RoomSummary } from "@syncwatch/shared";

type Route = { name: "lobby" } | { name: "room" } | { name: "history" };

interface NavState {
  route: Route;
  currentRoom: RoomSummary | null;
  enterRoom: (room: RoomSummary) => void;
  updateRoom: (room: RoomSummary) => void;
  leaveRoom: () => void;
  goToHistory: () => void;
  goToLobby: () => void;
}

export const useNavStore = create<NavState>((set) => ({
  route: { name: "lobby" },
  currentRoom: null,
  enterRoom: (room) => set({ route: { name: "room" }, currentRoom: room }),
  updateRoom: (room) => set({ currentRoom: room }),
  leaveRoom: () => set({ route: { name: "lobby" }, currentRoom: null }),
  goToHistory: () => set({ route: { name: "history" } }),
  goToLobby: () => set({ route: { name: "lobby" }, currentRoom: null }),
}));
