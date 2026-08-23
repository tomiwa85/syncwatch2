import type { Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import {
  SocketEvents,
  chatSendPayloadSchema,
  fileVerifyPayloadSchema,
  playbackActionPayloadSchema,
  playbackSeekPayloadSchema,
  roomEndPayloadSchema,
  roomJoinPayloadSchema,
  roomLeavePayloadSchema,
  roomSetControlPayloadSchema,
  subtitleClearPayloadSchema,
  subtitleSetPayloadSchema,
  videoSetSourcePayloadSchema,
} from "@syncwatch/shared";
import { isAllowedOrigin } from "../config/cors.js";
import { prisma } from "../db/prisma.js";
import { verifyAccessToken } from "../modules/auth/auth.service.js";
import {
  endRoomIfHost,
  getRoomByCode,
  getRoomControl,
  joinRoom,
  setPlaybackControl,
  setRoomSource,
} from "../modules/rooms/rooms.service.js";
import { roomState, toPlaybackState, toWire } from "./room-state.store.js";

interface SocketData {
  userId: string;
  displayName: string;
}

const HEARTBEAT_MS = 5000;

// How long the room survives after the host's socket drops, so a brief network
// blip doesn't kick everyone. If the host reconnects within this window the
// pending end is cancelled.
const HOST_GRACE_MS = 45000;

// Rooms with a pending "end" timer (host disconnected, awaiting reconnect).
const pendingRoomEnds = new Map<string, NodeJS.Timeout>();

function cancelPendingEnd(code: string): void {
  const timer = pendingRoomEnds.get(code);
  if (timer) {
    clearTimeout(timer);
    pendingRoomEnds.delete(code);
  }
}

// Whether a user may drive playback: always in EVERYONE mode, host-only in HOST mode.
async function canControlPlayback(code: string, userId: string): Promise<boolean> {
  const control = await getRoomControl(code);
  if (!control) return false;
  return control.playbackControl === "EVERYONE" || control.hostId === userId;
}

export function attachSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: (origin, cb) => cb(null, isAllowedOrigin(origin)), credentials: true },
  });

  // Authenticate every connection with the JWT access token.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("unauthorized"));
      const { userId } = verifyAccessToken(token);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return next(new Error("unauthorized"));
      (socket.data as SocketData) = { userId: user.id, displayName: user.displayName };
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const { userId, displayName } = socket.data as SocketData;

    socket.on(SocketEvents.RoomJoin, async (payload) => {
      const parsed = roomJoinPayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = parsed.data.roomCode.toUpperCase();

      try {
        const room = await joinRoom(userId, code);
        socket.join(code);

        // If the host is (re)joining, cancel any pending end from a brief drop.
        if (room.hostId === userId) cancelPendingEnd(code);

        const snapshot = await roomState.snapshot(code);
        socket.emit(SocketEvents.RoomState, { room, playback: toPlaybackState(snapshot) });

        socket.to(code).emit(SocketEvents.RoomMemberJoined, { userId, displayName });
      } catch {
        socket.emit("room:error", { message: "Could not join room" });
      }
    });

    // Host explicitly ends the room now (their "End party" button) — skip grace.
    socket.on(SocketEvents.RoomEnd, async (payload) => {
      const parsed = roomEndPayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = parsed.data.roomCode.toUpperCase();
      cancelPendingEnd(code);
      if (await endRoomIfHost(userId, code)) {
        io.to(code).emit(SocketEvents.RoomEnded, { roomCode: code });
        roomState.evict(code);
      }
    });

    // A `room:leave` means "stop watching in this view" — the socket may still be
    // connected (e.g. navigating to the lobby). The room only ends when the host's
    // socket actually disconnects, so a transient leave/rejoin can't kill the room.
    socket.on(SocketEvents.RoomLeave, (payload) => {
      const parsed = roomLeavePayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = parsed.data.roomCode.toUpperCase();
      socket.leave(code);
      socket.to(code).emit(SocketEvents.RoomMemberLeft, { userId });
    });

    socket.on(SocketEvents.PlaybackPlay, async (payload) => {
      const parsed = playbackActionPayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = parsed.data.roomCode.toUpperCase();
      if (!socket.rooms.has(code) || !(await canControlPlayback(code, userId))) return;
      const state = await roomState.play(code, parsed.data.atTime);
      io.to(code).emit(SocketEvents.PlaybackSync, toWire(state, "user"));
    });

    socket.on(SocketEvents.PlaybackPause, async (payload) => {
      const parsed = playbackActionPayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = parsed.data.roomCode.toUpperCase();
      if (!socket.rooms.has(code) || !(await canControlPlayback(code, userId))) return;
      const state = await roomState.pause(code, parsed.data.atTime);
      io.to(code).emit(SocketEvents.PlaybackSync, toWire(state, "user"));
    });

    socket.on(SocketEvents.PlaybackSeek, async (payload) => {
      const parsed = playbackSeekPayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = parsed.data.roomCode.toUpperCase();
      if (!socket.rooms.has(code) || !(await canControlPlayback(code, userId))) return;
      const state = await roomState.seek(code, parsed.data.toTime);
      io.to(code).emit(SocketEvents.PlaybackSync, toWire(state, "user"));
    });

    // Host toggles who can control playback.
    socket.on(SocketEvents.RoomSetControl, async (payload) => {
      const parsed = roomSetControlPayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = parsed.data.roomCode.toUpperCase();
      if (!socket.rooms.has(code)) return;
      try {
        const room = await setPlaybackControl(userId, code, parsed.data.playbackControl);
        const snapshot = await roomState.snapshot(code);
        io.to(code).emit(SocketEvents.RoomState, { room, playback: toPlaybackState(snapshot) });
      } catch (err) {
        socket.emit("room:error", { message: err instanceof Error ? err.message : "Could not update controls" });
      }
    });

    // Real-time chat.
    socket.on(SocketEvents.ChatSend, (payload) => {
      const parsed = chatSendPayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = parsed.data.roomCode.toUpperCase();
      if (!socket.rooms.has(code)) return;
      io.to(code).emit(SocketEvents.ChatMessage, {
        id: randomUUID(),
        userId,
        displayName,
        text: parsed.data.text,
        at: new Date().toISOString(),
      });
    });

    // Host shares subtitles (WebVTT) with the room.
    socket.on(SocketEvents.SubtitleSet, async (payload) => {
      const parsed = subtitleSetPayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = parsed.data.roomCode.toUpperCase();
      if (!socket.rooms.has(code)) return;
      const control = await getRoomControl(code);
      if (control?.hostId !== userId) return; // host-only
      io.to(code).emit(SocketEvents.SubtitleChanged, { fileName: parsed.data.fileName, vtt: parsed.data.vtt });
    });

    socket.on(SocketEvents.SubtitleClear, async (payload) => {
      const parsed = subtitleClearPayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = parsed.data.roomCode.toUpperCase();
      if (!socket.rooms.has(code)) return;
      const control = await getRoomControl(code);
      if (control?.hostId !== userId) return;
      io.to(code).emit(SocketEvents.SubtitleCleared, {});
    });

    // Host chooses the video source for the room.
    socket.on(SocketEvents.VideoSetSource, async (payload) => {
      const parsed = videoSetSourcePayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = parsed.data.roomCode.toUpperCase();
      if (!socket.rooms.has(code)) return;

      try {
        const room = await setRoomSource(userId, code, parsed.data.source);
        roomState.evict(code); // playback was reset to 0/paused in the DB
        const snapshot = await roomState.snapshot(code);
        io.to(code).emit(SocketEvents.RoomState, { room, playback: toPlaybackState(snapshot) });
        io.to(code).emit(SocketEvents.VideoSourceChanged, { source: parsed.data.source });
      } catch (err) {
        socket.emit("room:error", { message: err instanceof Error ? err.message : "Could not set source" });
      }
    });

    // File verification (host sets a local-file source; members report theirs).
    socket.on(SocketEvents.FileVerify, async (payload) => {
      const parsed = fileVerifyPayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = parsed.data.roomCode.toUpperCase();
      if (!socket.rooms.has(code)) return;

      try {
        const room = await getRoomByCode(code);
        const source = room.source;
        // Match on file SIZE only: the same encode is a reliable match even when
        // the two people named the file differently. (Byte-size collisions between
        // genuinely different videos are effectively impossible.)
        const verified =
          source?.sourceType === "LOCAL_FILE" && source.fileSize === parsed.data.fileSize;

        await prisma.roomMember.updateMany({
          where: { room: { code }, userId },
          data: {
            localFileName: parsed.data.fileName,
            localFileSize: BigInt(parsed.data.fileSize),
            fileVerified: verified,
          },
        });

        io.to(code).emit(SocketEvents.FileVerifyResult, {
          userId,
          verified,
          ...(verified ? {} : { reason: "File size does not match the room's file" }),
        });
      } catch {
        /* ignore */
      }
    });

    // Use `disconnecting` — on `disconnect`, socket.rooms is already cleared.
    socket.on("disconnecting", async () => {
      const codes = [...socket.rooms].filter((c) => c !== socket.id);
      for (const code of codes) {
        const control = await getRoomControl(code);
        const isHost = control?.hostId === userId;

        if (isHost) {
          // Don't kick everyone on a brief host drop. Start (or keep) a grace
          // timer; a host reconnect within the window cancels it. The host is
          // left in the member list meanwhile so others don't see them vanish.
          if (!pendingRoomEnds.has(code)) {
            const timer = setTimeout(async () => {
              pendingRoomEnds.delete(code);
              if (await endRoomIfHost(userId, code)) {
                io.to(code).emit(SocketEvents.RoomEnded, { roomCode: code });
                roomState.evict(code);
              }
            }, HOST_GRACE_MS);
            pendingRoomEnds.set(code, timer);
          }
        } else {
          socket.to(code).emit(SocketEvents.RoomMemberLeft, { userId });
        }
      }
    });
  });

  // Heartbeat: keep everyone converged on the authoritative position.
  setInterval(() => {
    for (const { code, state } of roomState.playingRooms()) {
      io.to(code).emit(SocketEvents.PlaybackSync, toWire(state, "heartbeat"));
    }
  }, HEARTBEAT_MS).unref();

  return io;
}
