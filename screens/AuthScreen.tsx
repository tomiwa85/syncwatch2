import { useState } from "react";
import { loginRequestSchema, signupRequestSchema } from "@syncwatch/shared";
import { Button } from "../design-system/components/Button.js";
import { Input } from "../design-system/components/Input.js";
import { useToast } from "../design-system/components/Toast.js";
import { Logo } from "../design-system/icons.js";
import { ApiError } from "../api/http.js";
import { login, signup } from "../api/auth.api.js";
import { useAuthStore } from "../state/auth.store.js";

type Mode = "login" | "signup";
type FieldErrors = Partial<Record<"email" | "password" | "displayName", string>>;

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const setSession = useAuthStore((s) => s.setSession);

  const isSignup = mode === "signup";

  function switchMode(next: Mode) {
    setMode(next);
    setErrors({});
    setPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const schema = isSignup ? signupRequestSchema : loginRequestSchema;
    const payload = isSignup ? { displayName, email, password } : { email, password };
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const session = isSignup
        ? await signup({ displayName, email, password })
        : await login({ email, password });
      setSession(session);
      toast({ title: `Welcome${isSignup ? "" : " back"}, ${session.user.displayName}`, tone: "success" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      toast({ title: isSignup ? "Could not create account" : "Could not sign in", description: message, tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={132} />
          <p className="mt-2 text-sm text-muted">
            {isSignup ? "Create your account to start watching together." : "Sign in to your watch parties."}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-sw-lg border border-border bg-surface p-6 shadow-sw">
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-brand opacity-70" />

          {/* mode toggle */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-sw bg-bg-2 p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={
                  "h-9 rounded-[9px] text-sm font-medium transition-all " +
                  (mode === m ? "bg-surface-raised text-text shadow-sm" : "text-muted hover:text-text")
                }
              >
                {m === "login" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {isSignup && (
              <Input
                label="Display name"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                error={errors.displayName}
                autoFocus
              />
            )}
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoFocus={!isSignup}
            />
            <Input
              label="Password"
              type="password"
              placeholder={isSignup ? "At least 8 characters" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />

            <Button type="submit" variant="gradient" size="lg" fullWidth disabled={submitting}>
              {submitting ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-muted">
          {isSignup ? "Already have an account?" : "New to SyncWatch?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(isSignup ? "login" : "signup")}
            className="font-medium text-accent hover:underline"
          >
            {isSignup ? "Sign in" : "Create one"}
          </button>
        </p>
      </div>
    </div>
  );
}
