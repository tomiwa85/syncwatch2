import type {
  CreateRoomResponse,
  GetHistoryResponse,
  GetRoomResponse,
  JoinRoomResponse,
  ListPublicRoomsResponse,
  PlaybackControl,
  RoomSummary,
  RoomVisibility,
  WatchHistoryEntry,
} from "@syncwatch/shared";
import { apiRequest } from "./http.js";

export async function createRoom(
  visibility: RoomVisibility,
  opts: { playbackControl?: PlaybackControl; password?: string } = {},
): Promise<RoomSummary> {
  const res = await apiRequest<CreateRoomResponse>("/api/rooms", {
    method: "POST",
    body: { visibility, playbackControl: opts.playbackControl, password: opts.password },
  });
  return res.room;
}

export async function getRoom(code: string): Promise<RoomSummary> {
  const res = await apiRequest<GetRoomResponse>(`/api/rooms/${code}`);
  return res.room;
}

export async function joinRoom(code: string, password?: string): Promise<RoomSummary> {
  const res = await apiRequest<JoinRoomResponse>(`/api/rooms/${code}/join`, {
    method: "POST",
    body: password ? { password } : {},
  });
  return res.room;
}

export async function listPublicRooms(): Promise<RoomSummary[]> {
  const res = await apiRequest<ListPublicRoomsResponse>("/api/rooms?visibility=public");
  return res.rooms;
}

/** Rooms the current user is hosting. */
export async function listMyRooms(): Promise<RoomSummary[]> {
  const res = await apiRequest<{ rooms: RoomSummary[] }>("/api/users/me/rooms");
  return res.rooms;
}

/** Permanently delete a room the user hosts. */
export async function deleteRoom(code: string): Promise<void> {
  await apiRequest<void>(`/api/rooms/${code}`, { method: "DELETE" });
}

/** Delete the current account and all associated data. Irreversible. */
export async function deleteAccount(): Promise<void> {
  await apiRequest<void>("/api/users/me", { method: "DELETE" });
}

export async function getHistory(): Promise<WatchHistoryEntry[]> {
  const res = await apiRequest<GetHistoryResponse>("/api/users/me/history");
  return res.entries;
}

/** Remove one item from the current user's watch history (their view only). */
export async function deleteHistoryEntry(roomCode: string): Promise<void> {
  await apiRequest<void>(`/api/users/me/history/${roomCode}`, { method: "DELETE" });
}
