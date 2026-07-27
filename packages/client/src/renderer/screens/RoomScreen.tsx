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
} from "../design-system/icons.js";
import { LocalVideoPlayer } from "../components/LocalVideoPlayer.js";
import { StreamingVideoPlayer } from "../components/StreamingVideoPlayer.js";
import type { PlayerHandle } from "../realtime/sync-engine.js";
import { pickVideo, type PickedVideo } from "../realtime/pickVideo.js";
import { disconnectSocket } from "../realtime/socket-client.js";
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
  }, [hasPlayer, source?.sourceType, isStreaming ? source?.url : myVideo?.playbackUrl, sync.engine]);

  if (!room) {
    leaveRoom();
    return null;
  }

  const isHost = room.hostId === userId;
  const me = room.members.find((m) => m.userId === userId);
  const isLocal = source?.sourceType === "LOCAL_FILE";
  const showChooser = isHost && (!source || changing);

  async function handleChooseFile() {
    const picked = await pickVideo();
    if (!picked) return;
    setMyVideo({ ...picked, forSig: `LF:${picked.fileName}:${picked.fileSize}` });
    sync.setSource({ sourceType: "LOCAL_FILE", fileName: picked.fileName, fileSize: picked.fileSize });
    setChanging(false);
    toast({ title: "Video set", description: picked.fileName, tone: "success" });
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
    setMyVideo({ ...picked, forSig: sig });
    sync.verifyFile(picked.fileName, picked.fileSize);
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
    // Host leaving ends the room: disconnecting triggers the server's
    // disconnect handler, which sets endedAt and notifies everyone.
    if (isHost) disconnectSocket();
    leaveRoom();
  }

  function copyCode() {
    void navigator.clipboard.writeText(room!.code);
    toast({ title: "Room code copied", tone: "success" });
  }

  const controls = (
    <Card className="flex items-center gap-4 py-3">
      <Button
        variant="gradient"
        size="sm"
        onClick={() => (sync.playback.isPlaying ? sync.engine.userPause() : sync.engine.userPlay())}
      >
        {sync.playback.isPlaying ? "Pause" : "Play"}
      </Button>
      <span className="font-mono text-sm tabular-nums text-muted">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(currentTime, duration || 0)}
        onChange={(e) => {
          const t = Number(e.target.value);
          setCurrentTime(t);
          sync.engine.userSeek(t);
        }}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-[color:var(--sw-accent)]"
      />
    </Card>
  );

  return (
    <div className="min-h-full">
      <TopBar />

      <main className="mx-auto grid max-w-6xl gap-6 px-8 py-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
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
            <Button variant="ghost" size="sm" onClick={handleLeave}>
              <LogOutIcon size={16} /> Leave
            </Button>
          </div>

          {showChooser ? (
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
            <div className="flex flex-col gap-3">
              <div className="aspect-video overflow-hidden rounded-sw bg-black">
                <StreamingVideoPlayer ref={playerRef} url={source.url} onTime={setCurrentTime} onDuration={setDuration} />
              </div>
              {controls}
            </div>
          ) : isLocal && myVideo ? (
            <div className="flex flex-col gap-3">
              <div className="aspect-video overflow-hidden rounded-sw">
                <LocalVideoPlayer ref={playerRef} src={myVideo.playbackUrl} onTime={setCurrentTime} onDuration={setDuration} />
              </div>
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
              {controls}
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

          {isHost && source && !changing && (
            <button onClick={() => setChanging(true)} className="self-start text-sm text-muted hover:text-accent">
              Change video…
            </button>
          )}
        </div>

        <aside className="flex flex-col gap-3">
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
        </aside>
      </main>
    </div>
  );
}
