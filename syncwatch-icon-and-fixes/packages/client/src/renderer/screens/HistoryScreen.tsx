import { useEffect, useState } from "react";
import type { WatchHistoryEntry } from "@syncwatch/shared";
import { Card } from "../design-system/components/Card.js";
import { Avatar } from "../design-system/components/Avatar.js";
import { Button } from "../design-system/components/Button.js";
import { FilmIcon, UsersIcon, TrashIcon } from "../design-system/icons.js";
import { deleteHistoryEntry, getHistory } from "../api/rooms.api.js";
import { useToast } from "../design-system/components/Toast.js";
import { useConfirm } from "../design-system/useConfirm.js";
import { useNavStore } from "../state/nav.store.js";
import { TopBar } from "./TopBar.js";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function HistoryScreen() {
  const goToLobby = useNavStore((s) => s.goToLobby);
  const { toast } = useToast();
  const confirm = useConfirm();
  const [entries, setEntries] = useState<WatchHistoryEntry[] | null>(null);

  useEffect(() => {
    getHistory()
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  async function handleDelete(entry: WatchHistoryEntry) {
    const ok = await confirm({
      title: "Remove from history?",
      description: `“${entry.title ?? `Room ${entry.roomCode}`}” will be removed from your history. This only affects your view.`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    const prev = entries;
    setEntries((cur) => cur?.filter((e) => !(e.roomCode === entry.roomCode && e.endedAt === entry.endedAt)) ?? cur);
    try {
      await deleteHistoryEntry(entry.roomCode);
    } catch {
      setEntries(prev ?? null); // roll back on failure
      toast({ title: "Couldn't remove that item", tone: "danger" });
    }
  }

  return (
    <div className="min-h-full">
      <TopBar />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Watch history</h1>
            <p className="mt-1 text-sm text-muted">Movies you've watched and who you watched them with.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={goToLobby}>
            Back to lobby
          </Button>
        </div>

        {entries === null ? (
          <Card className="text-sm text-muted">Loading your history…</Card>
        ) : entries.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-accent">
              <FilmIcon size={26} />
            </span>
            <div>
              <p className="font-medium">No watch parties yet</p>
              <p className="text-sm text-muted">Once a room ends, it'll show up here.</p>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map((entry) => (
              <Card key={`${entry.roomCode}-${entry.endedAt}`} className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sw bg-brand-soft text-accent">
                    <FilmIcon size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.title ?? `Room ${entry.roomCode}`}</p>
                    <p className="text-xs text-muted">{formatWhen(entry.endedAt)}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {entry.coWatchers.length === 0 ? (
                    <span className="text-xs text-muted">watched solo</span>
                  ) : (
                    <>
                      <div className="flex -space-x-2">
                        {entry.coWatchers.slice(0, 4).map((c) => (
                          <Avatar key={c.userId} name={c.displayName} size="sm" className="ring-2 ring-surface" />
                        ))}
                      </div>
                      <span className="flex items-center gap-1 text-xs text-muted">
                        <UsersIcon size={13} />
                        {entry.coWatchers.length}
                      </span>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(entry)}
                    aria-label="Remove from history"
                    title="Remove from history"
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
    </div>
  );
}
