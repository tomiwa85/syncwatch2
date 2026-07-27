import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import {
  SocketEvents,
  fileVerifyPayloadSchema,
  playbackActionPayloadSchema,
  playbackSeekPayloadSchema,
  roomJoinPayloadSchema,
  roomLeavePayloadSchema,
  videoSetSourcePayloadSchema,
} from "@syncwatch/shared";
import { isAllowedOrigin } from "../config/cors.js";
import { prisma } from "../db/prisma.js";
import { verifyAccessToken } from "../modules/auth/auth.service.js";
import { endRoomIfHost, getRoomByCode, joinRoom, setRoomSource } from "../modules/rooms/rooms.service.js";
import { roomState, toPlaybackState, toWire } from "./room-state.store.js";

interface SocketData {
  userId: string;
  displayName: string;
}

const HEARTBEAT_MS = 5000;

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

        const snapshot = await roomState.snapshot(code);
        socket.emit(SocketEvents.RoomState, { room, playback: toPlaybackState(snapshot) });

        socket.to(code).emit(SocketEvents.RoomMemberJoined, { userId, displayName });
      } catch {
        socket.emit("room:error", { message: "Could not join room" });
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
      if (!socket.rooms.has(code)) return;
      const state = await roomState.play(code, parsed.data.atTime);
      io.to(code).emit(SocketEvents.PlaybackSync, toWire(state, "user"));
    });

    socket.on(SocketEvents.PlaybackPause, async (payload) => {
      const parsed = playbackActionPayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = parsed.data.roomCode.toUpperCase();
      if (!socket.rooms.has(code)) return;
      const state = await roomState.pause(code, parsed.data.atTime);
      io.to(code).emit(SocketEvents.PlaybackSync, toWire(state, "user"));
    });

    socket.on(SocketEvents.PlaybackSeek, async (payload) => {
      const parsed = playbackSeekPayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      const code = parsed.data.roomCode.toUpperCase();
      if (!socket.rooms.has(code)) return;
      const state = await roomState.seek(code, parsed.data.toTime);
      io.to(code).emit(SocketEvents.PlaybackSync, toWire(state, "user"));
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
        const verified =
          source?.sourceType === "LOCAL_FILE" &&
          source.fileName === parsed.data.fileName &&
          source.fileSize === parsed.data.fileSize;

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
          ...(verified ? {} : { reason: "File name or size does not match the room's file" }),
        });
      } catch {
        /* ignore */
      }
    });

    // Use `disconnecting` — on `disconnect`, socket.rooms is already cleared.
    socket.on("disconnecting", async () => {
      const codes = [...socket.rooms].filter((c) => c !== socket.id);
      for (const code of codes) {
        socket.to(code).emit(SocketEvents.RoomMemberLeft, { userId });
        if (await endRoomIfHost(userId, code)) {
          io.to(code).emit(SocketEvents.RoomEnded, { roomCode: code });
          roomState.evict(code);
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
