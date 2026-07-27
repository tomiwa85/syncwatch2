import type { ComponentType, ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "../cn.js";
import { XCircleIcon } from "../icons.js";

type IconComponent = ComponentType<{ size?: number }>;
export type ModalTone = "brand" | "danger" | "success" | "info" | "warning";

const toneWrap: Record<ModalTone, string> = {
  brand: "bg-brand-soft text-accent",
  danger: "bg-danger-soft text-danger",
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
};

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  icon?: IconComponent;
  tone?: ModalTone;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  showClose?: boolean;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  tone = "brand",
  children,
  footer,
  className,
  showClose = true,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-sw-lg border border-border bg-surface p-6 shadow-sw animate-scale-in focus:outline-none",
            className,
          )}
        >
          {/* gradient hairline at the very top edge */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-sw-lg bg-brand opacity-70" />

          <div className="flex items-start gap-4">
            {Icon && (
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-sw", toneWrap[tone])}>
                <Icon size={22} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              {title && <Dialog.Title className="text-lg font-semibold leading-tight text-text">{title}</Dialog.Title>}
              {description && (
                <Dialog.Description className="mt-1.5 text-sm leading-relaxed text-muted">
                  {description}
                </Dialog.Description>
              )}
            </div>
            {showClose && (
              <Dialog.Close
                className="-mr-1 -mt-1 rounded-sw p-1 text-muted/70 transition-colors hover:bg-surface-raised hover:text-text"
                aria-label="Close"
              >
                <XCircleIcon size={18} />
              </Dialog.Close>
            )}
          </div>

          {children && <div className={cn("mt-5", Icon && "pl-[60px]")}>{children}</div>}
          {footer && <div className={cn("mt-6 flex justify-end gap-2", Icon && "pl-[60px]")}>{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
