import { useEffect, useState } from "react";
import { cn } from "../design-system/cn.js";
import { Logo, Wordmark } from "../design-system/icons.js";

/** Branded opening screen shown briefly on launch, then fades out. */
const LOADING_LINES = [
  "Warming things up…",
  "Connecting to your watch parties…",
  "Syncing up…",
  "Almost ready…",
];

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [line, setLine] = useState(0);

  useEffect(() => {
    // Cycle the loading message while the splash is up.
    const cycle = window.setInterval(() => setLine((n) => (n + 1) % LOADING_LINES.length), 900);
    const t1 = window.setTimeout(() => setLeaving(true), 2900);
    const t2 = window.setTimeout(onDone, 3350);
    return () => {
      window.clearInterval(cycle);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg transition-opacity duration-500",
        leaving && "pointer-events-none opacity-0",
      )}
    >
      <div className="sw-pop flex flex-col items-center">
        <Logo size={148} />
        <Wordmark className="mt-4 text-2xl font-bold tracking-tight" />
      </div>
      <div className="mt-10 h-1 w-44 overflow-hidden rounded-full bg-surface-raised">
        <div className="sw-indeterminate h-full w-1/3 rounded-full bg-brand" />
      </div>
      <p className="mt-4 h-4 text-xs text-muted transition-opacity duration-300">{LOADING_LINES[line]}</p>
    </div>
  );
}
