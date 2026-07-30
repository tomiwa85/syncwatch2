import { useEffect, useState } from "react";
import { cn } from "../design-system/cn.js";
import { Logo, Wordmark } from "../design-system/icons.js";

/** Branded opening screen shown briefly on launch, then fades out. */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setLeaving(true), 1400);
    const t2 = window.setTimeout(onDone, 1850);
    return () => {
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
      <div className="mt-10 h-1 w-40 overflow-hidden rounded-full bg-surface-raised">
        <div className="sw-indeterminate h-full w-1/3 rounded-full bg-brand" />
      </div>
    </div>
  );
}
