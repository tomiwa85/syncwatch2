import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";
import { cn } from "../cn.js";
import { EyeIcon, EyeOffIcon } from "../icons.js";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, type, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    // Password fields get a show/hide toggle so users can verify what they typed.
    const isPassword = type === "password";
    const [reveal, setReveal] = useState(false);
    const effectiveType = isPassword && reveal ? "text" : type;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-muted">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={effectiveType}
            className={cn(
              "h-10 w-full rounded-sw border bg-surface px-3 text-sm text-text placeholder:text-muted/50",
              "transition-all focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-[color:var(--sw-ring)]",
              isPassword && "pr-10",
              error ? "border-danger" : "border-border",
              className,
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              tabIndex={-1}
              aria-label={reveal ? "Hide password" : "Show password"}
              title={reveal ? "Hide password" : "Show password"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sw p-1 text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:text-text"
            >
              {reveal ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
            </button>
          )}
        </div>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    );
  },
);
Input.displayName = "Input";
