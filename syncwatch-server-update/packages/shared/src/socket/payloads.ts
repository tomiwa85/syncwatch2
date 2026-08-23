import { z } from "zod";
import { playbackControlSchema, playbackStateSchema, roomSummarySchema, videoSourceSchema } from "../models/room-state.js";

// client -> server

export const roomJoinPayloadSchema = z.object({ roomCode: z.string() });
export type RoomJoinPayload = z.infer<typeof roomJoinPayloadSchema>;

export const roomLeavePayloadSchema = z.object({ roomCode: z.string() });
export type RoomLeavePayload = z.infer<typeof roomLeavePayloadSchema>;

// Host explicitly ends the room now (bypasses the disconnect grace period).
export const roomEndPayloadSchema = z.object({ roomCode: z.string() });
export type RoomEndPayload = z.infer<typeof roomEndPayloadSchema>;

export const videoSetSourcePayloadSchema = z.object({
  roomCode: z.string(),
  source: videoSourceSchema,
});
export type VideoSetSourcePayload = z.infer<typeof videoSetSourcePayloadSchema>;

export const roomSetControlPayloadSchema = z.object({
  roomCode: z.string(),
  playbackControl: playbackControlSchema,
});
export type RoomSetControlPayload = z.infer<typeof roomSetControlPayloadSchema>;

export const chatSendPayloadSchema = z.object({
  roomCode: z.string(),
  text: z.string().min(1).max(1000),
});
export type ChatSendPayload = z.infer<typeof chatSendPayloadSchema>;

export const subtitleSetPayloadSchema = z.object({
  roomCode: z.string(),
  fileName: z.string(),
  /** WebVTT content (converted from .srt if needed). */
  vtt: z.string().max(2_000_000),
});
export type SubtitleSetPayload = z.infer<typeof subtitleSetPayloadSchema>;

export const subtitleClearPayloadSchema = z.object({ roomCode: z.string() });
export type SubtitleClearPayload = z.infer<typeof subtitleClearPayloadSchema>;

export const fileVerifyPayloadSchema = z.object({
  roomCode: z.string(),
  fileName: z.string(),
  fileSize: z.number().int().positive(),
});
export type FileVerifyPayload = z.infer<typeof fileVerifyPayloadSchema>;

export const playbackActionPayloadSchema = z.object({
  roomCode: z.string(),
  atTime: z.number().min(0),
  clientTimestamp: z.number(),
});
export type PlaybackActionPayload = z.infer<typeof playbackActionPayloadSchema>;

export const playbackSeekPayloadSchema = z.object({
  roomCode: z.string(),
  toTime: z.number().min(0),
  clientTimestamp: z.number(),
});
export type PlaybackSeekPayload = z.infer<typeof playbackSeekPayloadSchema>;

// server -> client

export const roomStatePayloadSchema = z.object({
  room: roomSummarySchema,
  playback: playbackStateSchema,
});
export type RoomStatePayload = z.infer<typeof roomStatePayloadSchema>;

export const roomMemberJoinedPayloadSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
});
export type RoomMemberJoinedPayload = z.infer<typeof roomMemberJoinedPayloadSchema>;

export const roomMemberLeftPayloadSchema = z.object({
  userId: z.string().uuid(),
});
export type RoomMemberLeftPayload = z.infer<typeof roomMemberLeftPayloadSchema>;

export const roomEndedPayloadSchema = z.object({
  roomCode: z.string(),
});
export type RoomEndedPayload = z.infer<typeof roomEndedPayloadSchema>;

export const videoSourceChangedPayloadSchema = z.object({
  source: videoSourceSchema,
});
export type VideoSourceChangedPayload = z.infer<typeof videoSourceChangedPayloadSchema>;

export const fileVerifyResultPayloadSchema = z.object({
  userId: z.string().uuid(),
  verified: z.boolean(),
  reason: z.string().optional(),
});
export type FileVerifyResultPayload = z.infer<typeof fileVerifyResultPayloadSchema>;

export const playbackSyncPayloadSchema = z.object({
  currentTime: z.number().min(0),
  isPlaying: z.boolean(),
  updatedAt: z.string().datetime(),
  origin: z.enum(["user", "heartbeat"]),
});
export type PlaybackSyncPayload = z.infer<typeof playbackSyncPayloadSchema>;

export const chatMessagePayloadSchema = z.object({
  id: z.string(),
  userId: z.string().uuid(),
  displayName: z.string(),
  text: z.string(),
  at: z.string().datetime(),
});
export type ChatMessagePayload = z.infer<typeof chatMessagePayloadSchema>;

export const subtitleChangedPayloadSchema = z.object({
  fileName: z.string(),
  vtt: z.string(),
});
export type SubtitleChangedPayload = z.infer<typeof subtitleChangedPayloadSchema>;
