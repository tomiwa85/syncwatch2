import { useEffect, useState } from "react";
import type { RoomSummary } from "@syncwatch/shared";
import { Button } from "../design-system/components/Button.js";
import { Card } from "../design-system/components/Card.js";
import { Badge } from "../design-system/components/Badge.js";
import { Avatar } from "../design-system/components/Avatar.js";
import { useToast } from "../design-system/components/Toast.js";
import { useConfirm } from "../design-system/useConfirm.js";
import { GridIcon, PlusIcon, GlobeIcon, LockIcon, TrashIcon, PlayIcon } from "../design-system/icons.js";
import { listMyRooms, deleteRoom } from "../api/rooms.api.js";
import { CreateRoomModal } from "../components/CreateRoomModal.js";
import { InfoHint } from "../components/InfoHint.js";
import { useNavStore } from "../state/nav.store.js";
import { TopBar } from "./TopBar.js";

export function MyRoomsScreen() {
  const goToLobby = useNavStore((s) => s.goToLobby);
  const enterRoom = useNavStore((s) => s.enterRoom);
  const { toast } = useToast();
  const confirm = useConfirm();
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  function refresh() {
    listMyRooms()
      .then(setRooms)
      .catch(() => setRooms([]));
  }
  useEffect(refresh, []);

  async function handleDelete(room: RoomSummary) {
    const ok = await confirm({
      title: "Delete this room?",
      description: `Room ${room.code} will be permanently deleted for everyone. This can't be undone.`,
      confirmLabel: "Delete room",
      tone: "danger",
    });
    if (!ok) return;
    const prev = rooms;
    setRooms((cur) => cur?.filter((r) => r.code !== room.code) ?? cur);
    try {
      await deleteRoom(room.code);
      toast({ title: "Room deleted", tone: "success" });
    } catch {
      setRooms(prev ?? null);
      toast({ title: "Couldn't delete the room", tone: "danger" });
    }
  }

  return (
    <div className="min-h-full">
      <TopBar />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <GridIcon size={22} /> My rooms
            </h1>
            <p className="mt-1 truncate text-sm text-muted">Rooms you're hosting — open, or delete them.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <InfoHint text="Create a new room">
              <Button variant="gradient" size="sm" className="whitespace-nowrap" onClick={() => setCreateOpen(true)}>
                <PlusIcon size={16} />
                <span className="hidden sm:inline">New room</span>
                <span className="sm:hidden">New</span>
              </Button>
            </InfoHint>
            <InfoHint text="Back to lobby">
              <Button variant="secondary" size="sm" className="whitespace-nowrap" onClick={goToLobby}>
                <span className="hidden sm:inline">Back to lobby</span>
                <span className="sm:hidden">Lobby</span>
              </Button>
            </InfoHint>
          </div>
        </div>

        {rooms === null ? (
          <Card className="text-sm text-muted">Loading your rooms…</Card>
        ) : rooms.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-accent">
              <GridIcon size={26} />
            </span>
            <div>
              <p className="font-medium">You're not hosting any rooms</p>
              <p className="text-sm text-muted">Create one and it'll show up here.</p>
            </div>
            <Button variant="gradient" size="sm" onClick={() => setCreateOpen(true)}>
              <PlusIcon size={16} /> Create a room
            </Button>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {rooms.map((room) => (
              <Card key={room.code} className="flex items-center justify-between gap-3 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex -space-x-2">
                    {room.members.slice(0, 4).map((m) => (
                      <Avatar key={m.userId} name={m.displayName} size="sm" className="ring-2 ring-surface" />
                    ))}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="tracking-widest">{room.code}</span>
                      {room.visibility === "PUBLIC" ? (
                        <InfoHint text="Public room">
                          <Badge tone="accent">
                            <GlobeIcon size={12} />
                            <span className="hidden sm:inline"> Public</span>
                          </Badge>
                        </InfoHint>
                      ) : (
                        <InfoHint text="Private room">
                          <Badge>
                            <LockIcon size={12} />
                            <span className="hidden sm:inline"> Private</span>
                          </Badge>
                        </InfoHint>
                      )}
                      {room.hasPassword && (
                        <InfoHint text="Password protected">
                          <Badge>
                            <LockIcon size={12} />
                            <span className="hidden sm:inline"> Password</span>
                          </Badge>
                        </InfoHint>
                      )}
                    </div>
                    <p className="text-xs text-muted">{room.members.length} in the room</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" onClick={() => enterRoom(room)}>
                    <PlayIcon size={14} /> Open
                  </Button>
                  <button
                    onClick={() => handleDelete(room)}
                    aria-label="Delete room"
                    title="Delete room"
                    className="rounded-sw p-2 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <CreateRoomModal open={createOpen} onOpenChange={setCreateOpen} onCreated={enterRoom} />
    </div>
  );
}
