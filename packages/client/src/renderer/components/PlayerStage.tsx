import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import type { ChatMessagePayload } from "@syncwatch/shared";
import { cn } from "../design-system/cn.js";
import {
  PlayIcon,
  PauseIcon,
  MaximizeIcon,
  MinimizeIcon,
  VolumeIcon,
  VolumeMuteIcon,
  MoreIcon,
  MessageIcon,
  XCircleIcon,
} from "../design-system/icons.js";

/** An item in the player's overflow (⋮) menu. */
export interface PlayerMenuItem {
  label: string;
  icon?: ComponentType<{ size?: number }>;
  onSelect: () => void;
  tone?: "default" | "danger";
}

/** Chat wired into the player so it works in fullscreen too. */
export interface PlayerChat {
  messages: ChatMessagePayload[];
  myUserId?: string;
  onSend: (text: string) => void;
}

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
  /** Items for the overflow (⋮) menu — e.g. subtitle controls. Hidden if empty. */
  menuItems?: PlayerMenuItem[];
  /** Room chat, surfaced as a slide-out panel + notifications (works fullscreen). */
  chat?: PlayerChat;
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
  menuItems,
  chat,
  children,
}: PlayerStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const hideTimer = useRef<number | null>(null);

  // ---- chat overlay (works in fullscreen, unlike the app-level sidebar) ----
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [unread, setUnread] = useState(0);
  const [popup, setPopup] = useState<ChatMessagePayload | null>(null);
  const lastSeen = useRef(0);
  const chatListRef = useRef<HTMLDivElement>(null);
  const popupTimer = useRef<number | null>(null);
  const messages = chat?.messages;

  useEffect(() => {
    if (!messages) return;
    if (chatOpen) {
      lastSeen.current = messages.length;
      setUnread(0);
      requestAnimationFrame(() => chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight }));
      return;
    }
    if (messages.length <= lastSeen.current) return;
    const fromOthers = messages.slice(lastSeen.current).filter((m) => m.userId !== chat?.myUserId);
    if (fromOthers.length) {
      setUnread((u) => u + fromOthers.length);
      setPopup(fromOthers[fromOthers.length - 1]);
      if (popupTimer.current) window.clearTimeout(popupTimer.current);
      popupTimer.current = window.setTimeout(() => setPopup(null), 4500);
    }
    lastSeen.current = messages.length;
  }, [messages, chatOpen, chat?.myUserId]);

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    const t = chatText.trim();
    if (!t || !chat) return;
    chat.onSend(t);
    setChatText("");
  }

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

  // Controls stay visible while paused, or while the overflow menu is open.
  const visible = active || !isPlaying || menuOpen;

  useEffect(() => {
    const onFs = () => {
      const fs = document.fullscreenElement === stageRef.current;
      setFullscreen(fs);
      // On mobile, rotate to landscape while fullscreen (and release on exit).
      // No-ops/throws harmlessly on desktop — hence the try/catch.
      try {
        const orientation = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void>; unlock?: () => void } }).orientation;
        if (fs) void orientation?.lock?.("landscape").catch(() => {});
        else orientation?.unlock?.();
      } catch {
        /* orientation lock unsupported (desktop) */
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen();
  }, []);

  // Spacebar toggles play/pause (standard media-player behavior), and only when
  // the user isn't typing in an input (e.g. the chat box).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      if ((e.code === "Space" || e.key === " ") && canControl) {
        e.preventDefault();
        onPlayPause();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canControl, onPlayPause, show]);

  // A tap on the video reveals/hides the controls — it does NOT toggle playback
  // (that's what the play button / spacebar / center button are for). Matches
  // how VLC and mobile players behave, so a stray click can't pause the movie.
  function onSurfaceClick() {
    if (menuOpen) { setMenuOpen(false); return; }
    if (chatOpen) { setChatOpen(false); return; } // tap-away closes the chat panel
    if (visible && isPlaying) setActive(false);
    else show();
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
      onMouseLeave={() => isPlaying && !menuOpen && setActive(false)}
    >
      {/* video — a tap toggles the controls, a double-click toggles fullscreen */}
      <div className="absolute inset-0" onClick={onSurfaceClick} onDoubleClick={toggleFullscreen}>
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

          {/* overflow (⋮) menu — subtitles etc. */}
          {menuItems && menuItems.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className={cn("transition hover:text-accent", menuOpen && "text-accent")}
                aria-label="More options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <MoreIcon size={20} />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute bottom-full right-0 mb-2 min-w-44 overflow-hidden rounded-sw border border-white/10 bg-black/90 py-1 text-sm text-white shadow-xl backdrop-blur"
                >
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        role="menuitem"
                        onClick={() => { setMenuOpen(false); item.onSelect(); }}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/10",
                          item.tone === "danger" ? "text-red-400" : "text-white/90",
                        )}
                      >
                        {Icon && <Icon size={16} />}
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <button onClick={toggleFullscreen} className="transition hover:text-accent" aria-label="Fullscreen">
            {fullscreen ? <MinimizeIcon size={20} /> : <MaximizeIcon size={20} />}
          </button>
        </div>
      </div>

      {/* floating chat button, top-right over the video — glows only on unread */}
      {chat && (
        <button
          onClick={() => setChatOpen(true)}
          className={cn(
            "absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70",
            !chatOpen && (visible || unread > 0) ? "opacity-100" : "pointer-events-none opacity-0",
            unread > 0 && !chatOpen && "sw-neon",
          )}
          aria-label="Chat"
        >
          <MessageIcon size={20} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}

      {/* incoming-message popup (below the button), in fullscreen when chat is closed */}
      {chat && popup && !chatOpen && fullscreen && (
        <button
          onClick={() => setChatOpen(true)}
          className="sw-pop absolute right-3 top-16 z-30 flex max-w-[70%] items-start gap-2 rounded-sw border border-white/10 bg-black/85 px-3 py-2 text-left text-white shadow-xl backdrop-blur"
        >
          <MessageIcon size={16} className="mt-0.5 shrink-0 text-accent" />
          <span className="min-w-0 text-xs">
            <span className="font-semibold">{popup.displayName}</span>{" "}
            <span className="text-white/80">{popup.text}</span>
          </span>
        </button>
      )}

      {/* slide-out chat panel (inside the stage, so it shows in fullscreen) */}
      {chat && (
        <div
          className={cn(
            "absolute right-0 top-0 z-20 flex h-full w-80 max-w-[85%] flex-col border-l border-white/10 bg-black/85 backdrop-blur-md transition-transform duration-300",
            chatOpen ? "translate-x-0" : "pointer-events-none translate-x-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <MessageIcon size={16} /> Chat
            </span>
            <button onClick={() => setChatOpen(false)} aria-label="Close chat" className="text-white/70 transition hover:text-white">
              <XCircleIcon size={20} />
            </button>
          </div>
          <div ref={chatListRef} className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages && messages.length > 0 ? (
              messages.map((m) => {
                const mine = m.userId === chat.myUserId;
                return (
                  <div key={m.id} className={cn("flex", mine && "justify-end")}>
                    <div className={cn("max-w-[85%] rounded-sw px-3 py-1.5 text-sm", mine ? "bg-accent text-accent-fg" : "bg-white/10 text-white")}>
                      {!mine && <p className="text-[11px] font-medium text-white/60">{m.displayName}</p>}
                      <p className="break-words">{m.text}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-6 text-center text-xs text-white/50">No messages yet. Say hi 👋</p>
            )}
          </div>
          <form onSubmit={sendChat} className="flex gap-2 border-t border-white/10 p-3">
            <input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Message…"
              maxLength={1000}
              className="h-9 flex-1 rounded-sw border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 focus-visible:border-accent focus-visible:outline-none"
            />
            <button type="submit" className="rounded-sw bg-brand px-3 text-sm font-medium text-white transition hover:brightness-110">
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
