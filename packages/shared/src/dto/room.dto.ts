import { z } from "zod";
import {
  roomVisibilitySchema,
  roomSummarySchema,
  watchHistoryEntrySchema,
  playbackControlSchema,
} from "../models/room-state.js";

export const createRoomRequestSchema = z.object({
  visibility: roomVisibilitySchema,
  playbackControl: playbackControlSchema.optional(),
  password: z.string().min(1).max(128).optional(),
});
export type CreateRoomRequest = z.infer<typeof createRoomRequestSchema>;

export const joinRoomRequestSchema = z.object({
  password: z.string().optional(),
});
export type JoinRoomRequest = z.infer<typeof joinRoomRequestSchema>;

export const createRoomResponseSchema = z.object({
  room: roomSummarySchema,
});
export type CreateRoomResponse = z.infer<typeof createRoomResponseSchema>;

export const getRoomResponseSchema = z.object({
  room: roomSummarySchema,
});
export type GetRoomResponse = z.infer<typeof getRoomResponseSchema>;

export const joinRoomResponseSchema = z.object({
  room: roomSummarySchema,
});
export type JoinRoomResponse = z.infer<typeof joinRoomResponseSchema>;

export const listPublicRoomsResponseSchema = z.object({
  rooms: z.array(roomSummarySchema),
});
export type ListPublicRoomsResponse = z.infer<typeof listPublicRoomsResponseSchema>;

export const getHistoryResponseSchema = z.object({
  entries: z.array(watchHistoryEntrySchema),
});
export type GetHistoryResponse = z.infer<typeof getHistoryResponseSchema>;
