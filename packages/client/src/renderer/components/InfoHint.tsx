import { useRef, useState, type ReactNode } from "react";
import { cn } from "../design-system/cn.js";

/**
 * Wraps a (possibly shortened) control and reveals its full meaning on a
 * press-and-hold — so a short label like "Lobby" can spell out "Back to lobby".
 * Tap still triggers the child's action; only a genuine long-press shows the
 * bubble and swallows the click that would otherwise fire on release.
 * On desktop the native `title` covers hover.
 */
export function InfoHint({ text, children, className }: { text: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);

  function clearTimer() {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function onPointerDown() {
    longPressed.current = false;
    clearTimer();
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      setOpen(true);
    }, 400);
  }

  function onPointerUp() {
    clearTimer();
    if (open) window.setTimeout(() => setOpen(false), 1600);
  }

  function onPointerLeave() {
    clearTimer();
    longPressed.current = false;
    setOpen(false);
  }

  return (
    <span
      className={cn("relative inline-flex", className)}
      title={text}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      // Swallow the click that follows a long-press so "hold to read" doesn't
      // also fire the button. A normal tap never sets longPressed, so it passes.
      onClickCapture={(e) => {
        if (longPressed.current) {
          e.preventDefault();
          e.stopPropagation();
          longPressed.current = false;
        }
      }}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="sw-pop pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-sw border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-text shadow-sw"
        >
          {text}
        </span>
      )}
    </span>
  );
}
