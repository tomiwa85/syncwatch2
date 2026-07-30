import { useLayoutEffect, useState } from "react";
import { Button } from "../design-system/components/Button.js";

export interface TourStep {
  /** id of the element to spotlight. Omit for a centered, untargeted step. */
  targetId?: string;
  title: string;
  body: string;
}

interface TourProps {
  steps: TourStep[];
  onDone: () => void;
}

const PAD = 8;

// A lightweight first-run coach-mark tour: dims the screen, spotlights the
// current target element, and shows a tooltip card with Next/Skip.
export function Tour({ steps, onDone }: TourProps) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];

  useLayoutEffect(() => {
    if (!step?.targetId) {
      setRect(null);
      return;
    }
    const el = document.getElementById(step.targetId);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const update = () => setRect(el.getBoundingClientRect());
    update();
    const id = window.setTimeout(update, 250); // after smooth scroll settles
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step]);

  const last = i === steps.length - 1;
  const next = () => (last ? onDone() : setI((n) => n + 1));

  // Tooltip position: below the target if there's room, else above; centered if untargeted.
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const below = !rect || rect.bottom + 180 < vh;
  const cardStyle: React.CSSProperties = rect
    ? {
        position: "fixed",
        top: below ? rect.bottom + PAD + 12 : undefined,
        bottom: below ? undefined : vh - rect.top + PAD + 12,
        left: Math.max(16, Math.min(rect.left, (typeof window !== "undefined" ? window.innerWidth : 1000) - 340)),
        maxWidth: 320,
      }
    : { position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", maxWidth: 340 };

  return (
    <div className="fixed inset-0 z-[90]">
      {/* dim + spotlight (a hole punched with a huge box-shadow) */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-xl transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(4, 6, 12, 0.78)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-[rgba(4,6,12,0.78)]" />
      )}

      {/* tooltip card */}
      <div
        style={cardStyle}
        className="w-[calc(100vw-32px)] rounded-sw-lg border border-border bg-surface p-4 shadow-sw sm:w-80"
      >
        <p className="font-semibold">{step.title}</p>
        <p className="mt-1 text-sm text-muted">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, n) => (
              <span
                key={n}
                className={"h-1.5 rounded-full transition-all " + (n === i ? "w-4 bg-accent" : "w-1.5 bg-border")}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!last && (
              <button onClick={onDone} className="text-sm text-muted hover:text-text">
                Skip
              </button>
            )}
            <Button size="sm" variant="gradient" onClick={next}>
              {last ? "Got it" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
