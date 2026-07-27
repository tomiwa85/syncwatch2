import type { PlaybackState } from "@syncwatch/shared";
import { prisma } from "../db/prisma.js";

// Authoritative playback state for one room, held in memory. `updatedAt` is the
// wall-clock (epoch ms) at which `currentTime` was true, so we can project the
// live position for late joiners and heartbeat ticks.
interface RoomPlayback {
  currentTime: number;
  isPlaying: boolean;
  updatedAt: number;
}

const cache = new Map<string, RoomPlayback>();

function project(state: RoomPlayback): RoomPlayback {
  if (!state.isPlaying) return state;
  const elapsed = (Date.now() - state.updatedAt) / 1000;
  return { ...state, currentTime: state.currentTime + elapsed };
}

export function toWire(state: RoomPlayback, origin: "user" | "heartbeat"): PlaybackState & { origin: "user" | "heartbeat" } {
  const p = project(state);
  return {
    currentTime: Math.max(0, p.currentTime),
    isPlaying: p.isPlaying,
    updatedAt: new Date(p.updatedAt).toISOString(),
    origin,
  };
}

/** Plain snapshot for a room:state payload (no origin field). */
export function toPlaybackState(state: RoomPlayback): PlaybackState {
  return {
    currentTime: Math.max(0, state.currentTime),
    isPlaying: state.isPlaying,
    updatedAt: new Date(state.updatedAt).toISOString(),
  };
}

async function load(code: string): Promise<RoomPlayback> {
  const cached = cache.get(code);
  if (cached) return cached;

  const room = await prisma.room.findUnique({ where: { code } });
  const state: RoomPlayback = {
    currentTime: room?.currentTimeSeconds ?? 0,
    isPlaying: room?.isPlaying ?? false,
    updatedAt: room?.stateUpdatedAt?.getTime() ?? Date.now(),
  };
  cache.set(code, state);
  return state;
}

async function persist(code: string, state: RoomPlayback): Promise<void> {
  await prisma.room.update({
    where: { code },
    data: {
      currentTimeSeconds: state.currentTime,
      isPlaying: state.isPlaying,
      stateUpdatedAt: new Date(state.updatedAt),
    },
  });
}

async function mutate(code: string, next: Partial<RoomPlayback>): Promise<RoomPlayback> {
  const current = await load(code);
  const updated: RoomPlayback = { ...current, ...next, updatedAt: Date.now() };
  cache.set(code, updated);
  await persist(code, updated);
  return updated;
}

export const roomState = {
  /** Projected authoritative snapshot for a joiner. */
  async snapshot(code: string): Promise<RoomPlayback> {
    return project(await load(code));
  },
  play(code: string, atTime: number) {
    return mutate(code, { currentTime: atTime, isPlaying: true });
  },
  pause(code: string, atTime: number) {
    return mutate(code, { currentTime: atTime, isPlaying: false });
  },
  seek(code: string, toTime: number) {
    return mutate(code, { currentTime: toTime });
  },
  /** Rooms currently playing, for heartbeat ticks. */
  playingRooms(): { code: string; state: RoomPlayback }[] {
    const out: { code: string; state: RoomPlayback }[] = [];
    for (const [code, state] of cache) {
      if (state.isPlaying) out.push({ code, state });
    }
    return out;
  },
  /** Drop a room from memory once it's empty (best-effort). */
  evict(code: string) {
    cache.delete(code);
  },
};
