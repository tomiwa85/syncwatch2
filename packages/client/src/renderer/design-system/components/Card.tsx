import type { HTMLAttributes } from "react";
import { cn } from "../cn.js";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-sw-lg border border-border bg-surface p-6", className)}
      {...props}
    />
  );
}
