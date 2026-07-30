import { useEffect, useRef, useState } from "react";
import {
  SocketEvents,
  type FileVerifyResultPayload,
  type PlaybackState,
  type PlaybackSyncPayload,
  type RoomMemberJoinedPayload,
  type RoomMemberLeftPayload,
  type RoomStatePayload,
  type VideoSource,
  type VideoSourceChangedPayload,
  type ChatMessagePayload,
  type SubtitleChangedPayload,
  type PlaybackControl,
} from "@syncwatch/shared";
import { connectSocket, getSocket } from "./socket-client.js";
import { SyncEngine, type PlaybackIntent } from "./sync-engine.js";
import { useNavStore } from "../state/nav.store.js";
import { useAuthStore } from "../state/auth.store.js";
import { useToast } from "../design-system/components/Toast.js";

interface RoomSync {
  connected: boolean;
  playback: PlaybackState;
  liveTime: number;
  engine: SyncEngine;
  /** True while this user's picked file is being checked against the host's. */
  verifyPending: boolean;
  messages: ChatMessagePayload[];
  subtitle: SubtitleChangedPayload | null;
  setSource: (source: VideoSource) => void;
  verifyFile: (fileName: string, fileSize: number) => void;
  setControl: (mode: PlaybackControl) => void;
  endRoom: () => void;
  sendChat: (text: string) => void;
  setSubtitle: (fileName: string, vtt: string) => void;
  clearSubtitle: () => void;
}

const initialPlayback: PlaybackState = {
  currentTime: 0,
  isPlaying: false,
  updatedAt: new Date().toISOString(),
};

export function useRoomSync(roomCode: string): RoomSync {
  const updateRoom = useNavStore((s) => s.updateRoom);
  const leaveRoom = useNavStore((s) => s.leaveRoom);
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState>(initialPlayback);
  const [liveTime, setLiveTime] = useState(0);
  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  const [subtitle, setSubtitleState] = useState<SubtitleChangedPayload | null>(null);
  const [verifyPending, setVerifyPending] = useState(false);
  const playbackRef = useRef(playback);
  playbackRef.current = playback;

  // One engine per hook instance; emits translate to socket playback events.
  const engineRef = useRef<SyncEngine>();
  if (!engineRef.current) {
    engineRef.current = new SyncEngine((intent: PlaybackIntent, time: number) => {
      const event =
        intent === "play"
          ? SocketEvents.PlaybackPlay
          : intent === "pause"
            ? SocketEvents.PlaybackPause
            : SocketEvents.PlaybackSeek;
      const timeKey = intent === "seek" ? "toTime" : "atTime";
      getSocket().emit(event, { roomCode, [timeKey]: time, clientTimestamp: Date.now() });
    });
  }
  const engine = engineRef.current;
  const hasConnected = useRef(false);
  const pendingHardSync = useRef(false);

  useEffect(() => {
    const socket = connectSocket();

    const onConnect = () => {
      const isReconnect = hasConnected.current;
      hasConnected.current = true;
      setConnected(true);
      if (isReconnect) {
        pendingHardSync.current = true; // force convergence after the gap
        toast({ title: "Reconnected", tone: "success" });
      }
      socket.emit(SocketEvents.RoomJoin, { roomCode });
    };
    const onDisconnect = () => setConnected(false);

    const onRoomState = (payload: RoomStatePayload) => {
      updateRoom(payload.room);
      setPlayback(payload.playback);
      const authoritative = { currentTime: payload.playback.currentTime, isPlaying: payload.playback.isPlaying };
      if (pendingHardSync.current) {
        pendingHardSync.current = false;
        engine.hardApply(authoritative);
      } else {
        engine.applyAuthoritative(authoritative);
      }
    };
    const onSync = (payload: PlaybackSyncPayload) => {
      setPlayback({ currentTime: payload.currentTime, isPlaying: payload.isPlaying, updatedAt: payload.updatedAt });
      engine.applyAuthoritative({ currentTime: payload.currentTime, isPlaying: payload.isPlaying });
    };
    const onMemberJoined = (payload: RoomMemberJoinedPayload) => {
      const room = useNavStore.getState().currentRoom;
      if (!room || room.members.some((m) => m.userId === payload.userId)) return;
      updateRoom({
        ...room,
        members: [...room.members, { userId: payload.userId, displayName: payload.displayName, role: "member", fileVerified: false }],
      });
    };
    const onMemberLeft = (payload: RoomMemberLeftPayload) => {
      const room = useNavStore.getState().currentRoom;
      if (!room) return;
      updateRoom({ ...room, members: room.members.filter((m) => m.userId !== payload.userId) });
    };
    const onVerifyResult = (payload: FileVerifyResultPayload) => {
      if (payload.userId === useAuthStore.getState().user?.id) setVerifyPending(false);
      const room = useNavStore.getState().currentRoom;
      if (!room) return;
      updateRoom({
        ...room,
        members: room.members.map((m) => (m.userId === payload.userId ? { ...m, fileVerified: payload.verified } : m)),
      });
    };
    const onRoomEnded = () => {
      toast({ title: "The host ended the watch party", description: "Find it later in your history.", tone: "neutral" });
      leaveRoom();
    };
    const onRoomError = (payload: { message?: string }) => {
      toast({ title: "Left the room", description: payload?.message ?? "This room is no longer available.", tone: "danger" });
      leaveRoom();
    };
    const onSourceChanged = (payload: VideoSourceChangedPayload) => {
      const room = useNavStore.getState().currentRoom;
      const myId = useAuthStore.getState().user?.id;
      if (!room || !myId || room.hostId === myId) return; // the host already knows
      const name = payload.source.sourceType === "LOCAL_FILE" ? payload.source.fileName : "a video link";
      toast({ title: "The host changed the video", description: name, tone: "neutral" });
    };
    const onChat = (payload: ChatMessagePayload) => setMessages((prev) => [...prev, payload]);
    const onSubtitleChanged = (payload: SubtitleChangedPayload) => setSubtitleState(payload);
    const onSubtitleCleared = () => setSubtitleState(null);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(SocketEvents.RoomState, onRoomState);
    socket.on(SocketEvents.PlaybackSync, onSync);
    socket.on(SocketEvents.RoomMemberJoined, onMemberJoined);
    socket.on(SocketEvents.RoomMemberLeft, onMemberLeft);
    socket.on(SocketEvents.FileVerifyResult, onVerifyResult);
    socket.on(SocketEvents.RoomEnded, onRoomEnded);
    socket.on(SocketEvents.VideoSourceChanged, onSourceChanged);
    socket.on(SocketEvents.ChatMessage, onChat);
    socket.on(SocketEvents.SubtitleChanged, onSubtitleChanged);
    socket.on(SocketEvents.SubtitleCleared, onSubtitleCleared);
    socket.on("room:error", onRoomError);

    if (socket.connected) onConnect();

    return () => {
      socket.emit(SocketEvents.RoomLeave, { roomCode });
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(SocketEvents.RoomState, onRoomState);
      socket.off(SocketEvents.PlaybackSync, onSync);
      socket.off(SocketEvents.RoomMemberJoined, onMemberJoined);
      socket.off(SocketEvents.RoomMemberLeft, onMemberLeft);
      socket.off(SocketEvents.FileVerifyResult, onVerifyResult);
      socket.off(SocketEvents.RoomEnded, onRoomEnded);
      socket.off(SocketEvents.VideoSourceChanged, onSourceChanged);
      socket.off(SocketEvents.ChatMessage, onChat);
      socket.off(SocketEvents.SubtitleChanged, onSubtitleChanged);
      socket.off(SocketEvents.SubtitleCleared, onSubtitleCleared);
      socket.off("room:error", onRoomError);
    };
  }, [roomCode, updateRoom, engine, leaveRoom, toast]);

  // Reset chat + subtitles when switching rooms.
  useEffect(() => {
    setMessages([]);
    setSubtitleState(null);
    setVerifyPending(false);
  }, [roomCode]);

  // Live-projected authoritative time (for the readout when no player is mounted).
  useEffect(() => {
    const id = setInterval(() => {
      const p = playbackRef.current;
      const base = p.isPlaying ? p.currentTime + (Date.now() - Date.parse(p.updatedAt)) / 1000 : p.currentTime;
      setLiveTime(Math.max(0, base));
    }, 250);
    return () => clearInterval(id);
  }, []);

  return {
    connected,
    verifyPending,
    messages,
    subtitle,
    setControl: (mode) => getSocket().emit(SocketEvents.RoomSetControl, { roomCode, playbackControl: mode }),
    endRoom: () => getSocket().emit(SocketEvents.RoomEnd, { roomCode }),
    sendChat: (text) => getSocket().emit(SocketEvents.ChatSend, { roomCode, text }),
    setSubtitle: (fileName, vtt) => getSocket().emit(SocketEvents.SubtitleSet, { roomCode, fileName, vtt }),
    clearSubtitle: () => getSocket().emit(SocketEvents.SubtitleClear, { roomCode }),
    playback,
    liveTime,
    engine,
    setSource: (source) => getSocket().emit(SocketEvents.VideoSetSource, { roomCode, source }),
    verifyFile: (fileName, fileSize) => {
      setVerifyPending(true);
      getSocket().emit(SocketEvents.FileVerify, { roomCode, fileName, fileSize });
    },
  };
}
