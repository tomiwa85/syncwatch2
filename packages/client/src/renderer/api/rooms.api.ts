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

export async function getHistory(): Promise<WatchHistoryEntry[]> {
  const res = await apiRequest<GetHistoryResponse>("/api/users/me/history");
  return res.entries;
}
