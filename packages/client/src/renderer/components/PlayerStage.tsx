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
  RotateIcon,
} from "../design-system/icons.js";
import { BackPriority, useBackHandler } from "../native/back-button.js";
import { isPhone, isTouchDevice, prefs, setStatusBarHidden } from "../native/platform.js";

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

/** Is the device itself held sideways? Uses the physical screen's dimensions,
 *  which swap on rotation but — unlike the viewport — don't change when the
 *  keyboard opens. Falls back to the orientation API, then the viewport. */
function isDeviceLandscape(): boolean {
  if (screen.width && screen.height) return screen.width > screen.height;
  const type = (screen.orientation as ScreenOrientation | undefined)?.type;
  if (type) return type.startsWith("landscape");
  return window.matchMedia("(orientation: landscape)").matches;
}

const AUTO_ROTATE_KEY = "sw-auto-rotate";
const ROTATE_HINT_KEY = "sw-rotate-hint-seen";
const SEEK_STEP = 10; // seconds per double-tap
const DOUBLE_TAP_MS = 280;

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
  /** Items for the overflow (⋮) menu — e.g. subtitle controls. */
  menuItems?: PlayerMenuItem[];
  /** Room chat, surfaced as a slide-out panel + notifications (works fullscreen). */
  chat?: PlayerChat;
  /** The actual player element (LocalVideoPlayer / StreamingVideoPlayer). */
  children: ReactNode;
}

// A themed "cinema" shell: the video fills it, with a floating title overlay and
// a control bar that auto-hides during playback. On phones, tilting sideways
// takes it fullscreen (and upright takes it back), like a native video app.
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
  const [fullscreen, setFullscreen] = useState(false); // real Fullscreen API
  const [pseudoFull, setPseudoFull] = useState(false); // CSS fallback when the API is refused
  const immersive = fullscreen || pseudoFull;
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const hideTimer = useRef<number | null>(null);
  // Lock to landscape only when the user tapped the fullscreen button; when they
  // got here by tilting, leave rotation free so tilting back exits.
  const lockOnFullscreen = useRef(false);

  const [autoRotate, setAutoRotate] = useState(() => prefs.get(AUTO_ROTATE_KEY) !== "0");
  const [showRotateHint, setShowRotateHint] = useState(false);
  const [seekFlash, setSeekFlash] = useState<{ side: "left" | "right"; key: number } | null>(null);
  const lastTap = useRef(0);

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

  // ---- fullscreen / immersive ----

  useEffect(() => {
    const onFs = () => {
      const fs = document.fullscreenElement === stageRef.current;
      setFullscreen(fs);
      try {
        const orientation = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void>; unlock?: () => void } }).orientation;
        if (fs && lockOnFullscreen.current) void orientation?.lock?.("landscape").catch(() => {});
        if (!fs) {
          lockOnFullscreen.current = false;
          orientation?.unlock?.();
        }
      } catch {
        /* orientation lock unsupported (desktop) */
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /** Go fullscreen. Without a user gesture (e.g. on rotation) the browser may
   *  refuse the Fullscreen API — then fill the screen with CSS instead. */
  const enterImmersive = useCallback(async (lock: boolean) => {
    const el = stageRef.current;
    if (!el || document.fullscreenElement === el) return;
    lockOnFullscreen.current = lock;
    try {
      await el.requestFullscreen({ navigationUI: "hide" });
    } catch {
      lockOnFullscreen.current = false;
      setPseudoFull(true);
    }
  }, []);

  const exitImmersive = useCallback(() => {
    setPseudoFull(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (immersive) exitImmersive();
    else void enterImmersive(true);
  }, [immersive, enterImmersive, exitImmersive]);

  // Tilt to fullscreen: landscape → immersive, portrait → back to the page.
  // Uses the *device* orientation, not the viewport shape — the on-screen
  // keyboard shrinks the viewport and must not count as "turned sideways".
  // Listens to every rotation signal, since Android WebViews differ in which fire.
  useEffect(() => {
    if (!isPhone || !autoRotate) return;
    let last = isDeviceLandscape();
    if (last) void enterImmersive(false); // already sideways when the video appears
    const check = () => {
      const now = isDeviceLandscape();
      if (now === last) return;
      last = now;
      if (now) void enterImmersive(false);
      else exitImmersive();
    };
    const mq = window.matchMedia("(orientation: landscape)");
    const orientation = screen.orientation as ScreenOrientation | undefined;
    mq.addEventListener("change", check);
    window.addEventListener("resize", check);
    orientation?.addEventListener("change", check);
    return () => {
      mq.removeEventListener("change", check);
      window.removeEventListener("resize", check);
      orientation?.removeEventListener("change", check);
    };
  }, [autoRotate, enterImmersive, exitImmersive]);

  // Leaving the room (unmount) must never strand the CSS fullscreen or status bar.
  useEffect(() => () => exitImmersive(), [exitImmersive]);

  // In immersive: hide the status bar, and stop the page behind from scrolling.
  useEffect(() => {
    setStatusBarHidden(immersive);
    if (!pseudoFull) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [immersive, pseudoFull]);
  useEffect(() => () => setStatusBarHidden(false), []);

  // One-time tip for phone users holding it upright.
  useEffect(() => {
    if (!isPhone || !autoRotate || prefs.get(ROTATE_HINT_KEY)) return;
    if (isDeviceLandscape()) return;
    setShowRotateHint(true);
    prefs.set(ROTATE_HINT_KEY, "1");
    const t = window.setTimeout(() => setShowRotateHint(false), 4500);
    return () => window.clearTimeout(t);
  }, [autoRotate]);

  function toggleAutoRotate() {
    setAutoRotate((on) => {
      prefs.set(AUTO_ROTATE_KEY, on ? "0" : "1");
      return !on;
    });
  }

  // Android Back: close overlays first, then leave fullscreen.
  useBackHandler(chatOpen || menuOpen, () => {
    setChatOpen(false);
    setMenuOpen(false);
  }, BackPriority.playerOverlay);
  useBackHandler(immersive, exitImmersive, BackPriority.player);

  // ---- keep the screen awake while the movie plays ----
  useEffect(() => {
    if (!isPlaying || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const s = await navigator.wakeLock.request("screen");
        if (cancelled) void s.release();
        else sentinel = s;
      } catch {
        /* denied (e.g. battery saver) — nothing to do */
      }
    };
    // The OS drops the lock when the app is backgrounded; re-take it on return.
    const onVisible = () => document.visibilityState === "visible" && void acquire();
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [isPlaying]);

  // ---- keyboard ----
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

  // ---- surface taps ----
  // Single tap reveals/hides the controls (never toggles playback, so a stray
  // tap can't pause the movie). On phones, double-tap the left/right side to
  // skip ∓10s, or the middle to toggle fullscreen — like native video apps.
  function onSurfaceClick(e: React.MouseEvent<HTMLDivElement>) {
    if (menuOpen) { setMenuOpen(false); return; }
    if (chatOpen) { setChatOpen(false); return; }

    const now = Date.now();
    if (isTouchDevice && now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      if (x < 0.38 || x > 0.62) {
        if (canControl && duration > 0) {
          const side = x < 0.38 ? "left" : "right";
          const next = Math.min(duration, Math.max(0, currentTime + (side === "left" ? -SEEK_STEP : SEEK_STEP)));
          onSeek(next);
          setSeekFlash({ side, key: now });
        }
      } else {
        toggleFullscreen();
      }
      show();
      return;
    }
    lastTap.current = now;

    if (visible && isPlaying) setActive(false);
    else show();
  }

  useEffect(() => {
    if (!seekFlash) return;
    const t = window.setTimeout(() => setSeekFlash(null), 650);
    return () => window.clearTimeout(t);
  }, [seekFlash]);

  function applyVolume(v: number) {
    setVolume(v);
    setMuted(v === 0);
    onVolume?.(v);
  }
  function toggleMute() {
    if (muted || volume === 0) {
      const v = volume === 0 ? 1 : volume;
      setVolume(v);
      setMuted(false);
      onVolume?.(v);
    } else {
      setMuted(true);
      onVolume?.(0);
    }
  }

  // Built-in menu entries join whatever the room passes in.
  const allMenuItems: PlayerMenuItem[] = [
    ...(menuItems ?? []),
    ...(isPhone
      ? [{ label: `Rotate for fullscreen: ${autoRotate ? "On" : "Off"}`, icon: RotateIcon, onSelect: toggleAutoRotate }]
      : []),
  ];

  return (
    <div
      ref={stageRef}
      className={cn(
        // Position is set per-mode: Tailwind emits `.relative` after `.fixed`, so
        // combining them would silently keep the immersive player in page flow.
        // overflow-clip, not -hidden: a hidden-overflow box can still be scrolled by
        // focus/scrollIntoView, which slid the whole player sideways to reveal the
        // parked chat panel. clip can never scroll.
        "group overflow-clip bg-black",
        pseudoFull
          ? "fixed inset-0 z-[70] h-dvh w-screen rounded-none"
          : fullscreen
            ? "relative h-screen w-screen rounded-none"
            : "relative aspect-video rounded-sw",
        !visible && "cursor-none",
      )}
      onMouseMove={isTouchDevice ? undefined : show}
      onMouseLeave={() => !isTouchDevice && isPlaying && !menuOpen && setActive(false)}
    >
      {/* video — tap toggles controls; desktop double-click toggles fullscreen */}
      <div
        className="absolute inset-0 select-none"
        onClick={onSurfaceClick}
        onDoubleClick={isTouchDevice ? undefined : toggleFullscreen}
      >
        {children}
      </div>

      {/* double-tap seek feedback */}
      {seekFlash && (
        <div
          key={seekFlash.key}
          className={cn(
            "sw-pop pointer-events-none absolute top-1/2 flex h-24 w-24 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm",
            seekFlash.side === "left" ? "left-[12%]" : "right-[12%]",
          )}
        >
          <span className="text-lg font-bold">{seekFlash.side === "left" ? `−${SEEK_STEP}` : `+${SEEK_STEP}`}</span>
          <span className="text-[11px] text-white/80">seconds</span>
        </div>
      )}

      {/* one-time "tilt for fullscreen" tip */}
      {showRotateHint && !immersive && (
        <div className="sw-pop pointer-events-none absolute left-1/2 top-12 z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-black/75 px-3.5 py-2 text-xs font-medium text-white backdrop-blur">
          <RotateIcon size={16} /> Turn your phone sideways for fullscreen
        </div>
      )}

      {/* title overlay */}
      {title && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-4 pr-16 transition-opacity duration-300",
            immersive && "pt-[max(1rem,env(safe-area-inset-top))]",
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

      {/* control bar — safe-area padding keeps it clear of notches / gesture bars */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent pt-8 transition-opacity duration-300",
          "pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]",
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
          aria-label="Seek"
        />
        <div className="flex items-center gap-3 text-white">
          <button onClick={() => canControl && onPlayPause()} disabled={!canControl} className="transition hover:text-accent disabled:opacity-40" aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
          </button>

          {/* volume — phones use the hardware buttons, so just a mute toggle there */}
          <div className="flex items-center gap-1.5">
            <button onClick={toggleMute} className="transition hover:text-accent" aria-label={muted ? "Unmute" : "Mute"}>
              {muted || volume === 0 ? <VolumeMuteIcon size={19} /> : <VolumeIcon size={19} />}
            </button>
            {!isTouchDevice && (
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => applyVolume(Number(e.target.value))}
                className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/25 accent-white"
                aria-label="Volume"
              />
            )}
          </div>

          <span className="whitespace-nowrap font-mono text-xs tabular-nums text-white/80">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {!canControl && <span className="hidden text-xs text-white/60 sm:inline">Host controls playback</span>}

          {/* overflow (⋮) menu */}
          {allMenuItems.length > 0 && (
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
                  className="absolute bottom-full right-0 mb-2 min-w-52 overflow-hidden rounded-sw border border-white/10 bg-black/90 py-1 text-sm text-white shadow-xl backdrop-blur"
                >
                  {allMenuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        role="menuitem"
                        onClick={() => { setMenuOpen(false); item.onSelect(); }}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/10",
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

          <button onClick={toggleFullscreen} className="transition hover:text-accent" aria-label={immersive ? "Exit fullscreen" : "Fullscreen"}>
            {immersive ? <MinimizeIcon size={20} /> : <MaximizeIcon size={20} />}
          </button>
        </div>
      </div>

      {/* floating chat button, top-right over the video — glows only on unread */}
      {chat && (
        <button
          onClick={() => setChatOpen(true)}
          className={cn(
            "absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70",
            immersive && "right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))]",
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
      {chat && popup && !chatOpen && immersive && (
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
            "absolute right-0 top-0 z-20 flex h-full w-80 max-w-[85%] flex-col border-l border-white/10 bg-black/85 backdrop-blur-md transition-[transform,visibility] duration-300",
            immersive && "pr-[env(safe-area-inset-right)]",
            // Invisible when closed so its input can't take focus off-screen.
            // Visibility flips after the slide, so the close animation still plays.
            chatOpen ? "visible translate-x-0" : "pointer-events-none invisible translate-x-full",
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
              enterKeyHint="send"
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
