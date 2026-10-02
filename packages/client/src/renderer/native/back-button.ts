import { useEffect, useRef } from "react";

// Android's hardware/gesture Back. The app has no URL history, so without this
// Android treats every Back as "exit app" — even mid-movie. Components register
// a handler while they have something to close; Back runs the most important
// one (highest priority, most recent on ties), and only falls through to
// screen navigation when nothing claims it.

/** Return `false` to decline (let the next handler try). */
type BackHandler = () => boolean | void;

interface Entry {
  id: number;
  priority: number;
  handler: { current: BackHandler };
}

export const BackPriority = {
  /** Screen-level (e.g. "leave this room?"). */
  screen: 10,
  /** Fullscreen / immersive video. */
  player: 50,
  /** Player overlays: chat panel, ⋮ menu. */
  playerOverlay: 60,
  /** Dialogs and sheets — always closed first. */
  dialog: 100,
} as const;

const stack: Entry[] = [];
let nextId = 1;

/** Run the top handler. Returns true if something handled Back. */
export function dispatchBack(): boolean {
  const ordered = [...stack].sort((a, b) => b.priority - a.priority || b.id - a.id);
  for (const entry of ordered) {
    if (entry.handler.current() !== false) return true;
  }
  return false;
}

/** Claim Back while `active` — e.g. while a dialog is open. */
export function useBackHandler(active: boolean, handler: BackHandler, priority: number = BackPriority.screen): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    const entry: Entry = { id: nextId++, priority, handler: ref };
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active, priority]);
}
