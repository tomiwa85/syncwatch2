import { useEffect, useRef, useState } from "react";
import type { VideoSource } from "@syncwatch/shared";
import { Button } from "../design-system/components/Button.js";
import { Card } from "../design-system/components/Card.js";
import { Badge } from "../design-system/components/Badge.js";
import { Avatar } from "../design-system/components/Avatar.js";
import { Input } from "../design-system/components/Input.js";
import { useToast } from "../design-system/components/Toast.js";
import { useConfirm } from "../design-system/useConfirm.js";
import {
  PlayIcon,
  GlobeIcon,
  LockIcon,
  CopyIcon,
  LogOutIcon,
  UsersIcon,
  FilmIcon,
  LinkIcon,
  CheckCircleIcon,
  AlertIcon,
  CaptionsIcon,
} from "../design-system/icons.js";
import { LocalVideoPlayer } from "../components/LocalVideoPlayer.js";
import { StreamingVideoPlayer } from "../components/StreamingVideoPlayer.js";
import { PlayerStage, type PlayerMenuItem } from "../components/PlayerStage.js";
import { ChatPanel } from "../components/ChatPanel.js";
import type { PlayerHandle } from "../realtime/sync-engine.js";
import { pickVideo, prepareForPlayback, type PickedVideo } from "../realtime/pickVideo.js";
import { pickSubtitle } from "../realtime/subtitles.js";
import { useAuthStore } from "../state/auth.store.js";
import { useNavStore } from "../state/nav.store.js";
import { useRoomSync } from "../realtime/useRoomSync.js";
import { TopBar } from "./TopBar.js";

function formatTime(seconds: number): string {
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function sourceSig(source: VideoSource | null): string {
  if (!source) return "none";
  return source.sourceType === "LOCAL_FILE" ? `LF:${source.fileName}:${source.fileSize}` : `SU:${source.url}`;
}
function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

interface MyVideo extends PickedVideo {
  forSig: string;
}

export function RoomScreen() {
  const room = useNavStore((s) => s.currentRoom);
  const leaveRoom = useNavStore((s) => s.leaveRoom);
  const userId = useAuthStore((s) => s.user?.id);
  const { toast } = useToast();
  const confirm = useConfirm();

  const sync = useRoomSync(room?.code ?? "");
  const playerRef = useRef<PlayerHandle>(null);
  const [myVideo, setMyVideo] = useState<MyVideo | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [urlInput, setUrlInput] = useState("");
  const [changing, setChanging] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const sig = sourceSig(room?.source ?? null);

  useEffect(() => {
    setMyVideo((cur) => (cur && cur.forSig !== sig ? null : cur));
  }, [sig]);

  const source = room?.source ?? null;
  const isStreaming = source?.sourceType === "STREAMING_URL";
  const hasPlayer = isStreaming || Boolean(myVideo);

  useEffect(() => {
    sync.engine.setPlayer(hasPlayer ? playerRef.current : null);
    return () => sync.engine.setPlayer(null);
  }, [hasPlayer, source?.sourceType, isStreaming ? source?.url : myVideo?.forSig, sync.engine]);

  // Pop-up notification for incoming chat messages from other people.
  const seenChat = useRef(0);
  useEffect(() => {
    const msgs = sync.messages;
    if (msgs.length > seenChat.current) {
      const newest = msgs[msgs.length - 1];
      if (seenChat.current > 0 && newest.userId !== userId) {
        toast({ title: newest.displayName, description: newest.text, tone: "neutral" });
      }
      seenChat.current = msgs.length;
    }
  }, [sync.messages, userId, toast]);

  if (!room) {
    leaveRoom();
    return null;
  }

  const isHost = room.hostId === userId;
  const me = room.members.find((m) => m.userId === userId);
  const hostName = room.members.find((m) => m.role === "host")?.displayName ?? "the host";
  const isLocal = source?.sourceType === "LOCAL_FILE";
  const showChooser = isHost && (!source || changing);
  const canControl = room.playbackControl === "EVERYONE" || isHost;

  async function handlePickSubtitle() {
    const sub = await pickSubtitle();
    if (sub) {
      sync.setSubtitle(sub.fileName, sub.vtt);
      toast({ title: "Subtitles added", description: sub.fileName, tone: "success" });
    }
  }

  async function handleChooseFile() {
    const picked = await pickVideo();
    if (!picked) return;
    setChanging(false);
    setPreparing(true);
    try {
      const playbackUrl = await prepareForPlayback(picked);
      setMyVideo({ ...picked, playbackUrl, forSig: `LF:${picked.fileName}:${picked.fileSize}` });
      sync.setSource({ sourceType: "LOCAL_FILE", fileName: picked.fileName, fileSize: picked.fileSize });
      toast({ title: "Video set", description: picked.fileName, tone: "success" });
    } catch (e) {
      toast({ title: "Couldn't prepare that video", description: e instanceof Error ? e.message : "", tone: "danger" });
    } finally {
      setPreparing(false);
    }
  }

  function handleSetUrl() {
    const url = urlInput.trim();
    if (!isValidUrl(url)) {
      toast({ title: "Enter a valid link", description: "Paste a full http(s) video URL.", tone: "danger" });
      return;
    }
    sync.setSource({ sourceType: "STREAMING_URL", url });
    setUrlInput("");
    setChanging(false);
    toast({ title: "Link set", tone: "success" });
  }

  async function handleSelectCopy() {
    const picked = await pickVideo();
    if (!picked || !source || source.sourceType !== "LOCAL_FILE") return;
    setPreparing(true);
    try {
      const playbackUrl = await prepareForPlayback(picked);
      setMyVideo({ ...picked, playbackUrl, forSig: sig });
      sync.verifyFile(picked.fileName, picked.fileSize);
    } catch (e) {
      toast({ title: "Couldn't prepare that video", description: e instanceof Error ? e.message : "", tone: "danger" });
    } finally {
      setPreparing(false);
    }
  }

  async function handleLeave() {
    const ok = await confirm({
      title: isHost ? "End this watch party?" : "Leave this room?",
      description: isHost
        ? "Leaving as the host ends the party for everyone."
        : "You can rejoin anytime with the room code.",
      confirmLabel: isHost ? "End party" : "Leave",
      tone: "danger",
    });
    if (!ok) return;
    // Host explicitly ends the room now (the server otherwise keeps it alive
    // through a brief host disconnect so a network blip doesn't kick everyone).
    if (isHost) sync.endRoom();
    leaveRoom();
  }

  function copyCode() {
    void navigator.clipboard.writeText(room!.code);
    toast({ title: "Room code copied", tone: "success" });
  }

  const togglePlay = () => (sync.playback.isPlaying ? sync.engine.userPause() : sync.engine.userPlay());

  // Overflow (⋮) menu on the player — subtitle controls (host, local video).
  const playerMenuItems: PlayerMenuItem[] | undefined =
    isHost && isLocal && myVideo
      ? [
          { label: sync.subtitle ? "Change subtitles" : "Add subtitles", icon: CaptionsIcon, onSelect: handlePickSubtitle },
          ...(sync.subtitle
            ? [{ label: "Remove subtitles", icon: CaptionsIcon, onSelect: () => sync.clearSubtitle(), tone: "danger" as const }]
            : []),
        ]
      : undefined;

  const stageProps = {
    title: room.title,
    isPlaying: sync.playback.isPlaying,
    currentTime,
    duration,
    canControl,
    onPlayPause: togglePlay,
    onSeek: (t: number) => {
      setCurrentTime(t);
      sync.engine.userSeek(t);
    },
    onVolume: (v: number) => playerRef.current?.setVolume?.(v),
    menuItems: playerMenuItems,
  };

  return (
    <div className="min-h-full">
      <TopBar />

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={copyCode}
                  className="group flex items-center gap-2 rounded-sw border border-border bg-surface px-3 py-1.5 transition-colors hover:border-border-strong"
                  title="Copy room code"
                >
                  <span className="text-lg font-semibold tracking-widest">{room.code}</span>
                  <CopyIcon size={15} />
                </button>
                {room.visibility === "PUBLIC" ? (
                  <Badge tone="accent">
                    <GlobeIcon size={12} /> Public
                  </Badge>
                ) : (
                  <Badge>
                    <LockIcon size={12} /> Private
                  </Badge>
                )}
                {isHost && <Badge tone="success">Host</Badge>}
                <Badge tone={sync.connected ? "success" : "neutral"}>{sync.connected ? "Live" : "Connecting…"}</Badge>
              </div>
              <p className="text-xs text-muted">
                Created by <span className="font-medium text-text">{hostName}</span>
                {isHost && " (you)"}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLeave}>
              <LogOutIcon size={16} /> Leave
            </Button>
          </div>

          {preparing ? (
            <Card className="flex aspect-video flex-col items-center justify-center gap-4 border-dashed bg-bg-2 text-center">
              <span className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-accent" />
              <div>
                <p className="font-medium">Preparing video…</p>
                <p className="text-sm text-muted">Getting your file ready to play. This is quick for most videos.</p>
              </div>
            </Card>
          ) : showChooser ? (
            <Card className="flex flex-col gap-5 p-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-accent">
                  <PlayIcon size={26} />
                </span>
                <div>
                  <p className="font-semibold">Choose what to watch</p>
                  <p className="text-sm text-muted">Play a local file together, or paste a video link.</p>
                </div>
              </div>

              <div className="flex justify-center">
                <Button variant="gradient" onClick={handleChooseFile}>
                  <FilmIcon size={17} /> Choose a local file
                </Button>
              </div>

              <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
                <span className="h-px flex-1 bg-border" /> or paste a link <span className="h-px flex-1 bg-border" />
              </div>

              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSetUrl();
                }}
              >
                <div className="flex-1">
                  <Input
                    placeholder="https://youtube.com/watch?v=…"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="secondary">
                  <LinkIcon size={16} /> Load
                </Button>
              </form>

              {changing && (
                <button onClick={() => setChanging(false)} className="self-center text-sm text-muted hover:text-text">
                  Cancel
                </button>
              )}
            </Card>
          ) : isStreaming ? (
            <PlayerStage {...stageProps}>
              <StreamingVideoPlayer ref={playerRef} url={source.url} onTime={setCurrentTime} onDuration={setDuration} />
            </PlayerStage>
          ) : isLocal && myVideo ? (
            <div className="flex flex-col gap-3">
              <PlayerStage {...stageProps}>
                <LocalVideoPlayer
                  ref={playerRef}
                  src={myVideo.playbackUrl}
                  subtitleVtt={sync.subtitle?.vtt ?? null}
                  onTime={setCurrentTime}
                  onDuration={setDuration}
                />
              </PlayerStage>
              {!isHost &&
                (me?.fileVerified ? (
                  <div className="flex items-center gap-2 text-sm text-success">
                    <CheckCircleIcon size={16} /> Your file matches the host — you're in sync.
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-sw border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
                    <AlertIcon size={16} /> Your file's name or size doesn't match the host's. You may be out of sync.
                  </div>
                ))}
            </div>
          ) : isLocal && !myVideo ? (
            <Card className="flex aspect-video flex-col items-center justify-center gap-4 border-dashed bg-bg-2 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-accent">
                <FilmIcon size={28} />
              </span>
              <div>
                <p className="font-medium">
                  {isHost ? "Select your copy to start playing" : `The host is watching “${source.fileName}”`}
                </p>
                <p className="text-sm text-muted">{formatSize(source.fileSize)} · select your own copy to watch in sync.</p>
              </div>
              <Button variant="gradient" onClick={handleSelectCopy}>
                Select your copy
              </Button>
            </Card>
          ) : (
            <Card className="flex aspect-video flex-col items-center justify-center gap-4 border-dashed bg-bg-2 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-accent">
                <PlayIcon size={28} />
              </span>
              <div>
                <p className="font-medium">No video yet</p>
                <p className="text-sm text-muted">Waiting for the host to choose a video.</p>
              </div>
            </Card>
          )}

          {isHost && source && !changing && !preparing && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setChanging(true)}>
                <FilmIcon size={16} /> Change video
              </Button>
              {isLocal && myVideo && (
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <CaptionsIcon size={14} /> Subtitles are in the ⋮ menu on the player
                </span>
              )}
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-3">
          {/* Host: who can control playback */}
          {isHost && (
            <Card className="flex flex-col gap-2 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Playback control</h2>
              <div className="grid grid-cols-2 gap-1 rounded-sw bg-bg-2 p-1">
                {(
                  [
                    { value: "EVERYONE", label: "Everyone" },
                    { value: "HOST", label: "Only me" },
                  ] as const
                ).map((opt) => {
                  const active = room.playbackControl === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => sync.setControl(opt.value)}
                      className={
                        "h-8 rounded-[9px] text-sm font-medium transition-all " +
                        (active ? "bg-surface-raised text-text shadow-sm" : "text-muted hover:text-text")
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}
          {!isHost && room.playbackControl === "HOST" && (
            <Card className="flex items-center gap-2 py-3 text-sm text-muted">
              <LockIcon size={16} /> The host controls playback in this room.
            </Card>
          )}

          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <UsersIcon size={16} /> In this room · {room.members.length}
          </h2>
          <Card className="flex flex-col gap-1 p-2">
            {room.members.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 rounded-sw px-2 py-2 hover:bg-surface-raised">
                <Avatar name={m.displayName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.displayName}
                    {m.userId === userId && <span className="text-muted"> (you)</span>}
                  </p>
                </div>
                {m.role === "host" ? (
                  <Badge tone="accent">Host</Badge>
                ) : isLocal ? (
                  m.fileVerified ? (
                    <Badge tone="success">Ready</Badge>
                  ) : (
                    <Badge>Not ready</Badge>
                  )
                ) : null}
              </div>
            ))}
          </Card>

          <ChatPanel messages={sync.messages} myUserId={userId} onSend={sync.sendChat} />
        </aside>
      </main>
    </div>
  );
}
