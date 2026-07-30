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
  SearchIcon,
} from "../design-system/icons.js";
import { ApiError } from "../api/http.js";
import { createRoom, getRoom, joinRoom, listPublicRooms } from "../api/rooms.api.js";
import { useAuthStore } from "../state/auth.store.js";
import { useNavStore } from "../state/nav.store.js";
import { Tour, type TourStep } from "../components/Tour.js";
import { TopBar } from "./TopBar.js";

const TOUR_KEY = "syncwatch-tour-lobby-v1";
const TOUR_STEPS: TourStep[] = [
  { title: "Welcome to SyncWatch 👋", body: "Watch movies and videos in perfect sync with friends. Here's a 20-second tour." },
  { targetId: "tour-create", title: "Create a room", body: "Host a watch party — public or private, with an optional password. You pick the video and everyone stays in sync." },
  { targetId: "tour-join", title: "Join with a code", body: "Got a room code from a friend? Enter it here to jump straight in." },
  { targetId: "tour-search", title: "Find rooms", body: "Browse public rooms, or paste an exact room ID to find a private one." },
];

export function LobbyScreen() {
  const user = useAuthStore((s) => s.user);
  const enterRoom = useNavStore((s) => s.enterRoom);
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [visibility, setVisibility] = useState<RoomVisibility>("PRIVATE");
  const [createPassword, setCreatePassword] = useState("");
  const [creating, setCreating] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string>();

  // Password prompt shown when joining a protected room.
  const [pwPrompt, setPwPrompt] = useState<{ code: string } | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState<string>();

  const [publicRooms, setPublicRooms] = useState<RoomSummary[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(true);

  // First-run guided tour (after the splash), shown once.
  const [showTour, setShowTour] = useState(false);
  useEffect(() => {
    if (localStorage.getItem(TOUR_KEY)) return;
    const t = window.setTimeout(() => setShowTour(true), 2100);
    return () => window.clearTimeout(t);
  }, []);
  function finishTour() {
    localStorage.setItem(TOUR_KEY, "1");
    setShowTour(false);
  }

  // Search: live-filters the public list, and looks up an exact code (so a
  // private room surfaces only when its full code is typed — never browsable).
  const [search, setSearch] = useState("");
  const [lookupResult, setLookupResult] = useState<RoomSummary | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const query = search.trim().toUpperCase();
  const filteredPublic = query
    ? publicRooms.filter((r) => r.code.includes(query) || (r.title ?? "").toUpperCase().includes(query))
    : publicRooms;
  // A private room found by exact code, not already shown among the public results.
  const privateMatch =
    lookupResult && !filteredPublic.some((r) => r.code === lookupResult.code) ? lookupResult : null;

  useEffect(() => {
    setLookupResult(null);
    // Room codes are 6 chars; only look up plausible full codes.
    if (query.length < 4 || publicRooms.some((r) => r.code === query)) return;
    const timer = setTimeout(async () => {
      setLookingUp(true);
      try {
        setLookupResult(await getRoom(query));
      } catch {
        setLookupResult(null);
      } finally {
        setLookingUp(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, publicRooms]);

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
      const room = await createRoom(visibility, { password: createPassword.trim() || undefined });
      setCreateOpen(false);
      setCreatePassword("");
      toast({ title: "Room created", description: `Share code ${room.code} to invite people.`, tone: "success" });
      enterRoom(room);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not create the room.";
      toast({ title: "Create failed", description: message, tone: "danger" });
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(code: string, password?: string) {
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      setJoinError("Enter a valid room code");
      return;
    }
    setJoinError(undefined);
    setJoining(true);
    try {
      const room = await joinRoom(clean, password);
      setPwPrompt(null);
      setPwInput("");
      toast({ title: `Joined ${room.code}`, tone: "success" });
      enterRoom(room);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // Room needs a password → open the prompt (or flag a wrong password).
        if (pwPrompt) setPwError("Wrong password");
        else setPwPrompt({ code: clean });
      } else if (err instanceof ApiError && err.status === 404) {
        setJoinError("No room with that code");
      } else {
        toast({ title: "Join failed", description: err instanceof ApiError ? err.message : "", tone: "danger" });
      }
    } finally {
      setJoining(false);
    }
  }

  // Private match (exact code) first, then the live-filtered public rooms.
  const results = [...(privateMatch ? [privateMatch] : []), ...filteredPublic];

  function renderRoomCard(room: RoomSummary) {
    const host = room.members.find((m) => m.role === "host")?.displayName ?? "someone";
    return (
      <Card key={room.code} className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {room.members.length > 0 ? (
              room.members.slice(0, 4).map((m) => (
                <Avatar key={m.userId} name={m.displayName} size="sm" className="ring-2 ring-surface" />
              ))
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-muted ring-2 ring-surface">
                <FilmIcon size={14} />
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 font-medium">
              <span className="tracking-widest">{room.code}</span>
              {room.visibility === "PUBLIC" ? (
                <Badge tone="accent">
                  <GlobeIcon size={12} /> Public
                </Badge>
              ) : (
                <Badge>
                  <LockIcon size={12} /> Private
                </Badge>
              )}
              {room.hasPassword && (
                <Badge>
                  <LockIcon size={12} /> Password
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted">
              {room.members.length} watching · hosted by {host}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => handleJoin(room.code)} disabled={joining}>
          Join
        </Button>
      </Card>
    );
  }

  return (
    <div className="min-h-full">
      <TopBar />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-2xl font-bold">
          Welcome back, <span className="bg-brand bg-clip-text text-transparent">{user?.displayName}</span>
        </h1>
        <p className="mt-1 text-muted">Start a watch party or join one with a room code.</p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Create */}
          <Card id="tour-create" className="flex flex-col gap-3">
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
          <Card id="tour-join" className="flex flex-col gap-3">
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

        {/* Browse & search rooms */}
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <GlobeIcon size={18} /> Browse rooms
            </h2>
            <Button variant="ghost" size="sm" onClick={refreshPublic}>
              Refresh
            </Button>
          </div>

          {/* Search: filters public rooms live; a private room appears only on an exact code match. */}
          <div id="tour-search" className="relative mb-3">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <SearchIcon size={16} />
            </span>
            <Input
              placeholder="Search by room ID or title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal"
            />
          </div>

          {loadingPublic ? (
            <Card className="text-sm text-muted">Loading rooms…</Card>
          ) : results.length > 0 ? (
            <div className="flex flex-col gap-2">{results.map(renderRoomCard)}</div>
          ) : query ? (
            <Card className="flex items-center gap-3 text-sm text-muted">
              <SearchIcon size={18} />
              {lookingUp ? "Searching…" : `No room matches “${query}”. Double-check the room ID.`}
            </Card>
          ) : (
            <Card className="flex items-center gap-3 text-sm text-muted">
              <FilmIcon size={18} /> No public rooms right now. Create one and make it public — or search a room ID above.
            </Card>
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
        <div className="mt-4">
          <Input
            label="Password (optional)"
            type="password"
            placeholder="Leave blank for no password"
            value={createPassword}
            onChange={(e) => setCreatePassword(e.target.value)}
          />
        </div>
      </Modal>

      {/* Join password prompt */}
      <Modal
        open={pwPrompt !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPwPrompt(null);
            setPwInput("");
            setPwError(undefined);
          }
        }}
        icon={LockIcon}
        tone="brand"
        title="This room is password-protected"
        description={`Enter the password to join ${pwPrompt?.code ?? ""}.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setPwPrompt(null); setPwInput(""); setPwError(undefined); }}>
              Cancel
            </Button>
            <Button variant="gradient" disabled={joining} onClick={() => pwPrompt && handleJoin(pwPrompt.code, pwInput)}>
              {joining ? "Joining…" : "Join"}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pwPrompt) handleJoin(pwPrompt.code, pwInput);
          }}
        >
          <Input
            label="Room password"
            type="password"
            placeholder="••••••••"
            value={pwInput}
            onChange={(e) => {
              setPwInput(e.target.value);
              setPwError(undefined);
            }}
            error={pwError}
            autoFocus
          />
        </form>
      </Modal>

      {showTour && <Tour steps={TOUR_STEPS} onDone={finishTour} />}
    </div>
  );
}
