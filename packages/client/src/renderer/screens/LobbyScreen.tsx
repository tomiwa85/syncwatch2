import { useEffect, useState } from "react";
import type { RoomSummary, RoomVisibility } from "@syncwatch/shared";
import { Button } from "../design-system/components/Button.js";
import { Input } from "../design-system/components/Input.js";
import { Card } from "../design-system/components/Card.js";
import { Badge } from "../design-system/components/Badge.js";
import { Avatar } from "../design-system/components/Avatar.js";
import { Modal } from "../design-system/components/Modal.js";
import { useToast } from "../design-system/components/Toast.js";
import {
  PlusIcon,
  UsersIcon,
  LockIcon,
  GlobeIcon,
  FilmIcon,
} from "../design-system/icons.js";
import { ApiError } from "../api/http.js";
import { createRoom, joinRoom, listPublicRooms } from "../api/rooms.api.js";
import { useAuthStore } from "../state/auth.store.js";
import { useNavStore } from "../state/nav.store.js";
import { TopBar } from "./TopBar.js";

export function LobbyScreen() {
  const user = useAuthStore((s) => s.user);
  const enterRoom = useNavStore((s) => s.enterRoom);
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [visibility, setVisibility] = useState<RoomVisibility>("PRIVATE");
  const [creating, setCreating] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string>();

  const [publicRooms, setPublicRooms] = useState<RoomSummary[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(true);

  async function refreshPublic() {
    setLoadingPublic(true);
    try {
      setPublicRooms(await listPublicRooms());
    } catch {
      /* non-fatal */
    } finally {
      setLoadingPublic(false);
    }
  }

  useEffect(() => {
    void refreshPublic();
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const room = await createRoom(visibility);
      setCreateOpen(false);
      toast({ title: "Room created", description: `Share code ${room.code} to invite people.`, tone: "success" });
      enterRoom(room);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not create the room.";
      toast({ title: "Create failed", description: message, tone: "danger" });
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(code: string) {
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      setJoinError("Enter a valid room code");
      return;
    }
    setJoinError(undefined);
    setJoining(true);
    try {
      const room = await joinRoom(clean);
      toast({ title: `Joined ${room.code}`, tone: "success" });
      enterRoom(room);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not join the room.";
      if (err instanceof ApiError && err.status === 404) setJoinError("No room with that code");
      else toast({ title: "Join failed", description: message, tone: "danger" });
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-full">
      <TopBar />

      <main className="mx-auto max-w-4xl px-8 py-12">
        <h1 className="text-2xl font-bold">
          Welcome back, <span className="bg-brand bg-clip-text text-transparent">{user?.displayName}</span>
        </h1>
        <p className="mt-1 text-muted">Start a watch party or join one with a room code.</p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Create */}
          <Card className="flex flex-col gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-sw bg-brand-soft text-accent">
              <PlusIcon size={22} />
            </span>
            <div>
              <h2 className="font-semibold">Create a room</h2>
              <p className="text-sm text-muted">Host a new watch party — public or private.</p>
            </div>
            <Button variant="gradient" onClick={() => setCreateOpen(true)}>
              Create a room
            </Button>
          </Card>

          {/* Join */}
          <Card className="flex flex-col gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-sw bg-brand-soft text-accent">
              <UsersIcon size={22} />
            </span>
            <div>
              <h2 className="font-semibold">Join a room</h2>
              <p className="text-sm text-muted">Enter a room code to watch with friends.</p>
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void handleJoin(joinCode);
              }}
            >
              <div className="flex-1">
                <Input
                  placeholder="Room code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  error={joinError}
                  maxLength={8}
                  className="uppercase tracking-widest"
                />
              </div>
              <Button type="submit" variant="secondary" disabled={joining}>
                {joining ? "Joining…" : "Join"}
              </Button>
            </form>
          </Card>
        </div>

        {/* Browse public rooms */}
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <GlobeIcon size={18} /> Public rooms
            </h2>
            <Button variant="ghost" size="sm" onClick={refreshPublic}>
              Refresh
            </Button>
          </div>

          {loadingPublic ? (
            <Card className="text-sm text-muted">Loading public rooms…</Card>
          ) : publicRooms.length === 0 ? (
            <Card className="flex items-center gap-3 text-sm text-muted">
              <FilmIcon size={18} /> No public rooms right now. Create one and make it public!
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {publicRooms.map((room) => (
                <Card key={room.code} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {room.members.slice(0, 4).map((m) => (
                        <Avatar key={m.userId} name={m.displayName} size="sm" className="ring-2 ring-surface" />
                      ))}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        <span className="tracking-widest">{room.code}</span>
                        <Badge tone="accent">
                          <GlobeIcon size={12} /> Public
                        </Badge>
                      </div>
                      <p className="text-xs text-muted">
                        {room.members.length} watching · hosted by{" "}
                        {room.members.find((m) => m.role === "host")?.displayName ?? "someone"}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleJoin(room.code)} disabled={joining}>
                    Join
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Create-room modal */}
      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        icon={PlusIcon}
        tone="brand"
        title="Create a watch party"
        description="Pick who can join. You can share the code either way."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="gradient" onClick={handleCreate} disabled={creating}>
              {creating ? "Creating…" : "Create room"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { value: "PRIVATE", icon: LockIcon, title: "Private", desc: "Only people with the code" },
              { value: "PUBLIC", icon: GlobeIcon, title: "Public", desc: "Anyone can find & join" },
            ] as const
          ).map((opt) => {
            const active = visibility === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setVisibility(opt.value)}
                className={
                  "flex flex-col items-start gap-2 rounded-sw border p-4 text-left transition-all " +
                  (active
                    ? "border-accent bg-brand-soft"
                    : "border-border bg-surface hover:border-border-strong")
                }
              >
                <span className={"flex h-9 w-9 items-center justify-center rounded-sw " + (active ? "bg-accent text-accent-fg" : "bg-surface-raised text-muted")}>
                  <Icon size={18} />
                </span>
                <span className="font-medium">{opt.title}</span>
                <span className="text-xs text-muted">{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
