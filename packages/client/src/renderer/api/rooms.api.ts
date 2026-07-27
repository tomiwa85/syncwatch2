import type {
  CreateRoomResponse,
  GetHistoryResponse,
  GetRoomResponse,
  JoinRoomResponse,
  ListPublicRoomsResponse,
  RoomSummary,
  RoomVisibility,
  WatchHistoryEntry,
} from "@syncwatch/shared";
import { apiRequest } from "./http.js";

export async function createRoom(visibility: RoomVisibility): Promise<RoomSummary> {
  const res = await apiRequest<CreateRoomResponse>("/api/rooms", {
    method: "POST",
    body: { visibility },
  });
  return res.room;
}

export async function getRoom(code: string): Promise<RoomSummary> {
  const res = await apiRequest<GetRoomResponse>(`/api/rooms/${code}`);
  return res.room;
}

export async function joinRoom(code: string): Promise<RoomSummary> {
  const res = await apiRequest<JoinRoomResponse>(`/api/rooms/${code}/join`, { method: "POST" });
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
