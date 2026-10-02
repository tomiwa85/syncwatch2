import { useEffect, type ReactNode } from "react";
import { cn } from "../design-system/cn.js";
import { XCircleIcon } from "../design-system/icons.js";
import { BackPriority, useBackHandler } from "../native/back-button.js";

/** A glassmorphic panel that slides up from the bottom with a blurred backdrop. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
  useBackHandler(open, onClose, BackPriority.dialog);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] transition-opacity duration-300",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!open}
    >
      {/* blurred backdrop */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/50 backdrop-blur-sm"
      />

      {/* glass panel */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto flex max-h-[75vh] w-full max-w-lg flex-col rounded-t-sw-lg border border-white/10 bg-surface/80 shadow-sw backdrop-blur-2xl transition-transform duration-300",
          open ? "translate-y-0" : "translate-y-full",
        )}
        style={{ backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.06), transparent 40%)" }}
      >
        <div className="flex justify-center pt-3">
          <span className="h-1.5 w-10 rounded-full bg-white/20" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-5 pb-2 pt-3">
            <div className="text-sm font-semibold text-text">{title}</div>
            <button onClick={onClose} aria-label="Close" className="text-muted transition-colors hover:text-text">
              <XCircleIcon size={20} />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}
