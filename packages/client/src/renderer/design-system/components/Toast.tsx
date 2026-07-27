import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cn } from "../cn.js";
import { CheckCircleIcon, InfoIcon, XCircleIcon } from "../icons.js";

type ToastTone = "neutral" | "success" | "danger";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (opts: { title: string; description?: string; tone?: ToastTone }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneConfig: Record<
  ToastTone,
  { icon: typeof InfoIcon; iconWrap: string; bar: string }
> = {
  neutral: { icon: InfoIcon, iconWrap: "bg-info-soft text-info", bar: "bg-info" },
  success: { icon: CheckCircleIcon, iconWrap: "bg-success-soft text-success", bar: "bg-success" },
  danger: { icon: XCircleIcon, iconWrap: "bg-danger-soft text-danger", bar: "bg-danger" },
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((opts: { title: string; description?: string; tone?: ToastTone }) => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, title: opts.title, description: opts.description, tone: opts.tone ?? "neutral" }]);
  }, []);

  const remove = (id: number) => setItems((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4000}>
        {children}
        {items.map((item) => {
          const cfg = toneConfig[item.tone];
          const Icon = cfg.icon;
          return (
            <ToastPrimitive.Root
              key={item.id}
              onOpenChange={(open) => !open && remove(item.id)}
              className={cn(
                "relative flex items-start gap-3 overflow-hidden rounded-sw border border-border bg-surface-raised/95 p-4 pl-5 shadow-sw backdrop-blur",
                "data-[state=open]:animate-slide-in data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
                "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform",
              )}
            >
              <span className={cn("absolute inset-y-0 left-0 w-1", cfg.bar)} />
              <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", cfg.iconWrap)}>
                <Icon size={18} />
              </span>
              <div className="flex-1 pt-0.5">
                <ToastPrimitive.Title className="text-sm font-semibold text-text">{item.title}</ToastPrimitive.Title>
                {item.description && (
                  <ToastPrimitive.Description className="mt-0.5 text-xs leading-relaxed text-muted">
                    {item.description}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close className="text-muted/60 transition-colors hover:text-text" aria-label="Close">
                <XCircleIcon size={16} />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[60] flex w-96 max-w-[100vw] flex-col gap-2.5 p-6 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
