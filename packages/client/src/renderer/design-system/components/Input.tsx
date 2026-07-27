import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "../cn.js";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-10 rounded-sw border bg-surface px-3 text-sm text-text placeholder:text-muted/50",
            "transition-all focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-[color:var(--sw-ring)]",
            error ? "border-danger" : "border-border",
            className,
          )}
          {...props}
        />
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    );
  },
);
Input.displayName = "Input";
