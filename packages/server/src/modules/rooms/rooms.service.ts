import argon2 from "argon2";
import type { Prisma, Room, RoomMember, User } from "@prisma/client";
import type { PlaybackControl, RoomSummary, RoomVisibility, VideoSource, WatchHistoryEntry } from "@syncwatch/shared";
import { prisma } from "../../db/prisma.js";

export class RoomError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// Human-shareable code: 6 chars, no ambiguous 0/O/1/I/L.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    const existing = await prisma.room.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new RoomError("Could not allocate a room code, please retry", 503);
}

type RoomWithMembers = Room & { members: (RoomMember & { user: User })[] };

function sourceOf(room: Room): VideoSource | null {
  if (room.sourceType === "STREAMING_URL" && room.streamingUrl) {
    return { sourceType: "STREAMING_URL", url: room.streamingUrl };
  }
  if (room.sourceType === "LOCAL_FILE" && room.localFileName && room.localFileSize != null) {
    return { sourceType: "LOCAL_FILE", fileName: room.localFileName, fileSize: Number(room.localFileSize) };
  }
  return null;
}

export function toRoomSummary(room: RoomWithMembers): RoomSummary {
  return {
    code: room.code,
    title: room.title,
    visibility: room.visibility as RoomVisibility,
    playbackControl: room.playbackControl as PlaybackControl,
    hasPassword: room.passwordHash != null,
    hostId: room.hostId,
    source: sourceOf(room),
    members: room.members.map((m) => ({
      userId: m.userId,
      displayName: m.user.displayName,
      role: m.role === "host" ? "host" : "member",
      fileVerified: m.fileVerified,
    })),
  };
}

const includeMembers = {
  members: { include: { user: true }, orderBy: { joinedAt: "asc" } },
} satisfies Prisma.RoomInclude;

export async function createRoom(
  userId: string,
  visibility: RoomVisibility,
  opts: { playbackControl?: PlaybackControl; password?: string } = {},
): Promise<RoomSummary> {
  const code = await generateUniqueCode();
  const passwordHash = opts.password ? await argon2.hash(opts.password, { type: argon2.argon2id }) : null;
  const room = await prisma.room.create({
    data: {
      code,
      hostId: userId,
      visibility,
      playbackControl: opts.playbackControl ?? "EVERYONE",
      passwordHash,
      members: { create: { userId, role: "host" } },
    },
    include: includeMembers,
  });
  return toRoomSummary(room);
}

/** Host-only playback-control mode of a room (for socket enforcement). */
export async function getRoomControl(code: string): Promise<{ hostId: string; playbackControl: PlaybackControl } | null> {
  const room = await prisma.room.findUnique({ where: { code }, select: { hostId: true, playbackControl: true } });
  return room ? { hostId: room.hostId, playbackControl: room.playbackControl as PlaybackControl } : null;
}

export async function setPlaybackControl(userId: string, code: string, mode: PlaybackControl): Promise<RoomSummary> {
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) throw new RoomError("Room not found", 404);
  if (room.hostId !== userId) throw new RoomError("Only the host can change this", 403);
  await prisma.room.update({ where: { code }, data: { playbackControl: mode } });
  return getRoomByCode(code);
}

export async function getRoomByCode(code: string): Promise<RoomSummary> {
  const room = await prisma.room.findUnique({ where: { code }, include: includeMembers });
  if (!room) throw new RoomError("Room not found", 404);
  return toRoomSummary(room);
}

export async function joinRoom(userId: string, code: string, password?: string): Promise<RoomSummary> {
  const room = await prisma.room.findUnique({
    where: { code },
    include: { members: { where: { userId }, select: { id: true } } },
  });
  if (!room) throw new RoomError("Room not found", 404);
  if (room.endedAt) throw new RoomError("This room has ended", 410);

  // Password gate: required for non-host, non-member joiners of a protected room.
  const alreadyMember = room.hostId === userId || room.members.length > 0;
  if (room.passwordHash && !alreadyMember) {
    const ok = password ? await argon2.verify(room.passwordHash, password) : false;
    if (!ok) throw new RoomError("This room needs a password", 401);
  }

  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId } },
    create: { roomId: room.id, userId, role: room.hostId === userId ? "host" : "member" },
    update: {},
  });

  const withMembers = await prisma.room.findUniqueOrThrow({ where: { id: room.id }, include: includeMembers });
  return toRoomSummary(withMembers);
}

export async function setRoomSource(userId: string, code: string, source: VideoSource): Promise<RoomSummary> {
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) throw new RoomError("Room not found", 404);
  if (room.hostId !== userId) throw new RoomError("Only the host can set the video", 403);

  const sourceData =
    source.sourceType === "LOCAL_FILE"
      ? {
          sourceType: "LOCAL_FILE" as const,
          localFileName: source.fileName,
          localFileSize: BigInt(source.fileSize),
          streamingUrl: null,
          title: source.fileName,
        }
      : {
          sourceType: "STREAMING_URL" as const,
          streamingUrl: source.url,
          localFileName: null,
          localFileSize: null,
        };

  await prisma.room.update({
    where: { code },
    data: { ...sourceData, currentTimeSeconds: 0, isPlaying: false, stateUpdatedAt: new Date() },
  });

  // Reset everyone's verification; the host defines the canonical local file.
  await prisma.roomMember.updateMany({
    where: { room: { code } },
    data: { fileVerified: false, localFileName: null, localFileSize: null },
  });

  if (source.sourceType === "LOCAL_FILE") {
    await prisma.roomMember.updateMany({
      where: { room: { code }, userId },
      data: { localFileName: source.fileName, localFileSize: BigInt(source.fileSize), fileVerified: true },
    });
  }

  return getRoomByCode(code);
}

export async function listPublicRooms(): Promise<RoomSummary[]> {
  const rooms = await prisma.room.findMany({
    where: { visibility: "PUBLIC", endedAt: null },
    include: includeMembers,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rooms.map(toRoomSummary);
}

/** End a room (once) when its host leaves. Returns true if it just ended. */
export async function endRoomIfHost(userId: string, code: string): Promise<boolean> {
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room || room.hostId !== userId || room.endedAt) return false;
  await prisma.room.update({ where: { code }, data: { endedAt: new Date() } });
  return true;
}

/** A user's watch history: ended rooms they were part of, newest first, with co-watchers. */
export async function getUserHistory(userId: string): Promise<WatchHistoryEntry[]> {
  const memberships = await prisma.roomMember.findMany({
    where: { userId, room: { endedAt: { not: null } } },
    include: { room: { include: { members: { include: { user: true } } } } },
    orderBy: { room: { endedAt: "desc" } },
    take: 100,
  });

  return memberships.map((m) => ({
    roomCode: m.room.code,
    title: m.room.title,
    endedAt: m.room.endedAt!.toISOString(),
    coWatchers: m.room.members
      .filter((rm) => rm.userId !== userId)
      .map((rm) => ({ userId: rm.userId, displayName: rm.user.displayName })),
  }));
}
