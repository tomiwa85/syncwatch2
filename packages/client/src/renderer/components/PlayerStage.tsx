import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../design-system/cn.js";
import {
  PlayIcon,
  PauseIcon,
  MaximizeIcon,
  MinimizeIcon,
  VolumeIcon,
  VolumeMuteIcon,
} from "../design-system/icons.js";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${s.toString().padStart(2, "0")}`;
}

interface PlayerStageProps {
  title?: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  /** false when host-only control is on and the viewer isn't the host. */
  canControl?: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolume?: (volume: number) => void;
  /** The actual player element (LocalVideoPlayer / StreamingVideoPlayer). */
  children: ReactNode;
}

// A themed "cinema" shell: the video fills it, with a floating title overlay and
// control bar that auto-hide during playback and reappear on activity. Owns
// fullscreen for its own container so the custom controls stay overlaid.
export function PlayerStage({
  title,
  isPlaying,
  currentTime,
  duration,
  canControl = true,
  onPlayPause,
  onSeek,
  onVolume,
  children,
}: PlayerStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const hideTimer = useRef<number | null>(null);

  const show = useCallback(() => {
    setActive(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setActive(false), 2800);
  }, []);

  useEffect(() => {
    show();
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [show, title]);

  // Controls always visible while paused.
  const visible = active || !isPlaying;

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen();
  }

  function applyVolume(v: number) {
    setVolume(v);
    setMuted(v === 0);
    onVolume?.(v);
  }
  function toggleMute() {
    if (muted || volume === 0) {
      applyVolume(volume === 0 ? 1 : volume);
      setMuted(false);
      onVolume?.(volume === 0 ? 1 : volume);
    } else {
      setMuted(true);
      onVolume?.(0);
    }
  }

  return (
    <div
      ref={stageRef}
      className={cn(
        "group relative overflow-hidden rounded-sw bg-black",
        fullscreen ? "h-screen w-screen rounded-none" : "aspect-video",
        !visible && "cursor-none",
      )}
      onMouseMove={show}
      onMouseLeave={() => isPlaying && setActive(false)}
    >
      {/* video */}
      <div className="absolute inset-0" onClick={() => canControl && onPlayPause()}>
        {children}
      </div>

      {/* title overlay */}
      {title && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-4 transition-opacity duration-300",
            visible ? "opacity-100" : "opacity-0",
          )}
        >
          <p className="truncate text-sm font-semibold text-white/90 drop-shadow">{title}</p>
        </div>
      )}

      {/* big center play/pause when paused */}
      {!isPlaying && canControl && (
        <button
          onClick={onPlayPause}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/50 p-5 text-white backdrop-blur transition hover:scale-105 hover:bg-black/60"
          aria-label="Play"
        >
          <PlayIcon size={34} />
        </button>
      )}

      {/* control bar */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8 transition-opacity duration-300",
          visible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {/* seek bar */}
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          disabled={!canControl}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="mb-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-[color:var(--sw-accent)] disabled:cursor-not-allowed"
        />
        <div className="flex items-center gap-3 text-white">
          <button onClick={() => canControl && onPlayPause()} disabled={!canControl} className="transition hover:text-accent disabled:opacity-40" aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
          </button>

          {/* volume */}
          <div className="flex items-center gap-1.5">
            <button onClick={toggleMute} className="transition hover:text-accent" aria-label="Mute">
              {muted || volume === 0 ? <VolumeMuteIcon size={19} /> : <VolumeIcon size={19} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => applyVolume(Number(e.target.value))}
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/25 accent-white"
            />
          </div>

          <span className="font-mono text-xs tabular-nums text-white/80">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {!canControl && <span className="text-xs text-white/60">Host controls playback</span>}

          <button onClick={toggleFullscreen} className="transition hover:text-accent" aria-label="Fullscreen">
            {fullscreen ? <MinimizeIcon size={20} /> : <MaximizeIcon size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
