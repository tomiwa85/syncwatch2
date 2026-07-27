// Framework-agnostic playback reconciliation.
//
// The player is driven exclusively through the engine: user actions apply to the
// player optimistically AND emit an outbound event, while authoritative updates
// from the server are applied to the player with a drift tolerance so small,
// harmless differences don't cause visible seeking. Because player-generated
// events are never interpreted as user intent (our custom controls call the
// engine directly), there is no seek→event→seek feedback loop.

export interface PlayerHandle {
  play(): void;
  pause(): void;
  seek(time: number): void;
  getCurrentTime(): number;
}

export interface AuthoritativeState {
  currentTime: number;
  isPlaying: boolean;
}

export type PlaybackIntent = "play" | "pause" | "seek";

/** Seconds of drift tolerated before the engine hard-corrects the player. */
export const DRIFT_THRESHOLD = 0.75;

export function shouldSeek(localTime: number, authoritativeTime: number, threshold = DRIFT_THRESHOLD): boolean {
  return Math.abs(localTime - authoritativeTime) > threshold;
}

export class SyncEngine {
  private player: PlayerHandle | null = null;
  private readonly emit: (intent: PlaybackIntent, time: number) => void;

  constructor(emit: (intent: PlaybackIntent, time: number) => void) {
    this.emit = emit;
  }

  setPlayer(player: PlayerHandle | null): void {
    this.player = player;
  }

  hasPlayer(): boolean {
    return this.player !== null;
  }

  // ---- local user intents (optimistic apply + broadcast) ----

  userPlay(): void {
    const time = this.player?.getCurrentTime() ?? 0;
    this.player?.play();
    this.emit("play", time);
  }

  userPause(): void {
    const time = this.player?.getCurrentTime() ?? 0;
    this.player?.pause();
    this.emit("pause", time);
  }

  userSeek(time: number): void {
    this.player?.seek(time);
    this.emit("seek", time);
  }

  // ---- authoritative state from the server ----

  applyAuthoritative(state: AuthoritativeState): void {
    const player = this.player;
    if (!player) return;

    if (shouldSeek(player.getCurrentTime(), state.currentTime)) {
      player.seek(state.currentTime);
    }
    if (state.isPlaying) player.play();
    else player.pause();
  }

  /** Force the player to the authoritative state, bypassing drift tolerance.
   *  Used after a reconnect to guarantee convergence following a network gap. */
  hardApply(state: AuthoritativeState): void {
    const player = this.player;
    if (!player) return;
    player.seek(state.currentTime);
    if (state.isPlaying) player.play();
    else player.pause();
  }
}
