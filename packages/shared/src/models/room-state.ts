import { z } from "zod";

export const roomVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);
export type RoomVisibility = z.infer<typeof roomVisibilitySchema>;

export const playbackControlSchema = z.enum(["EVERYONE", "HOST"]);
export type PlaybackControl = z.infer<typeof playbackControlSchema>;

export const roomRoleSchema = z.enum(["host", "member"]);
export type RoomRole = z.infer<typeof roomRoleSchema>;

export const localFileSourceSchema = z.object({
  sourceType: z.literal("LOCAL_FILE"),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
});
export type LocalFileSource = z.infer<typeof localFileSourceSchema>;

export const streamingUrlSourceSchema = z.object({
  sourceType: z.literal("STREAMING_URL"),
  url: z.string().url(),
});
export type StreamingUrlSource = z.infer<typeof streamingUrlSourceSchema>;

export const videoSourceSchema = z.discriminatedUnion("sourceType", [
  localFileSourceSchema,
  streamingUrlSourceSchema,
]);
export type VideoSource = z.infer<typeof videoSourceSchema>;

export const playbackStateSchema = z.object({
  currentTime: z.number().min(0),
  isPlaying: z.boolean(),
  updatedAt: z.string().datetime(),
});
export type PlaybackState = z.infer<typeof playbackStateSchema>;

export const roomMemberSummarySchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  role: roomRoleSchema,
  fileVerified: z.boolean(),
});
export type RoomMemberSummary = z.infer<typeof roomMemberSummarySchema>;

export const roomSummarySchema = z.object({
  code: z.string(),
  title: z.string().nullable(),
  visibility: roomVisibilitySchema,
  playbackControl: playbackControlSchema,
  hasPassword: z.boolean(),
  hostId: z.string().uuid(),
  source: videoSourceSchema.nullable(),
  members: z.array(roomMemberSummarySchema),
});
export type RoomSummary = z.infer<typeof roomSummarySchema>;

export const watchHistoryEntrySchema = z.object({
  roomCode: z.string(),
  title: z.string().nullable(),
  endedAt: z.string().datetime(),
  coWatchers: z.array(
    z.object({ userId: z.string().uuid(), displayName: z.string() }),
  ),
});
export type WatchHistoryEntry = z.infer<typeof watchHistoryEntrySchema>;
