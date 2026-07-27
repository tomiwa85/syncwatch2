import type { ComponentType, ReactNode } from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { cn } from "../cn.js";

type IconComponent = ComponentType<{ size?: number }>;

export interface DropdownItem {
  label: string;
  onSelect: () => void;
  icon?: IconComponent;
  tone?: "default" | "danger";
  separatorBefore?: boolean;
}

export function DropdownMenu({
  trigger,
  items,
  label,
  align = "end",
}: {
  trigger: ReactNode;
  items: DropdownItem[];
  label?: string;
  align?: "start" | "center" | "end";
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          sideOffset={8}
          align={align}
          className={cn(
            "z-50 min-w-52 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-sw border border-border",
            "bg-surface-raised/95 p-1.5 shadow-sw backdrop-blur animate-dropdown-in",
          )}
        >
          {label && (
            <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted/70">{label}</div>
          )}
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i}>
                {item.separatorBefore && <Dropdown.Separator className="my-1.5 h-px bg-border" />}
                <Dropdown.Item
                  onSelect={item.onSelect}
                  className={cn(
                    "group flex cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-sm outline-none transition-colors",
                    item.tone === "danger"
                      ? "text-danger data-[highlighted]:bg-danger-soft"
                      : "text-text data-[highlighted]:bg-brand-soft data-[highlighted]:text-accent",
                  )}
                >
                  {Icon && (
                    <span className="text-muted transition-colors group-data-[highlighted]:text-current">
                      <Icon size={17} />
                    </span>
                  )}
                  {item.label}
                </Dropdown.Item>
              </div>
            );
          })}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
