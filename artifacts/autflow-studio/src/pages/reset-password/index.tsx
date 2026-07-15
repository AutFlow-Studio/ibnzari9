import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

type PageState = "validating" | "invalid" | "form" | "success";

function getToken(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") ?? "";
}

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [pageState, setPageState] = useState<PageState>("validating");
  const [invalidReason, setInvalidReason] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const token = getToken();

  // Validate the token on mount
  useEffect(() => {
    if (!token) {
      setInvalidReason("No reset token provided.");
      setPageState("invalid");
      return;
    }

    fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: { valid: boolean; reason?: string }) => {
        if (data.valid) {
          setPageState("form");
        } else {
          setInvalidReason(data.reason ?? "This reset link is invalid or has expired.");
          setPageState("invalid");
        }
      })
      .catch(() => {
        setInvalidReason("Unable to verify the reset link. Please try again.");
        setPageState("invalid");
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical.",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Your new password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        setPageState("success");
        setTimeout(() => navigate("/"), 3000);
        return;
      }

      const body = await res.json().catch(() => ({}));
      if (res.status === 400 || res.status === 410) {
        setInvalidReason(body.error ?? "This link is no longer valid.");
        setPageState("invalid");
      } else {
        toast({
          title: "Reset failed",
          description: body.error ?? "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Network error",
        description: "Unable to reset your password. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary-foreground"
            >
              <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
              <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9" />
              <path d="M12 3v6" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AutFlow Studio</h1>
            <p className="text-sm text-muted-foreground">Agency Owner Operating System</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-8 shadow-xl">
          {/* Validating */}
          {pageState === "validating" && (
            <div className="flex flex-col items-center gap-3 py-4 text-muted-foreground">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Verifying link…</p>
            </div>
          )}

          {/* Invalid / expired */}
          {pageState === "invalid" && (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-destructive"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="m15 9-6 6" />
                  <path d="m9 9 6 6" />
                </svg>
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Link invalid or expired</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{invalidReason}</p>
              </div>
              <Link
                href="/forgot-password"
                className="inline-block w-full h-10 leading-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors text-center"
              >
                Request a new link
              </Link>
            </div>
          )}

          {/* Password form */}
          {pageState === "form" && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Set a new password</h2>
                <p className="text-sm text-muted-foreground">Must be at least 8 characters.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-medium">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 px-3 pr-10 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all placeholder:text-muted-foreground/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <path d="m1 1 22 22" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirm" className="text-sm font-medium">
                    Confirm new password
                  </label>
                  <input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all placeholder:text-muted-foreground/60"
                  />
                  {confirm && password !== confirm && (
                    <p className="text-xs text-destructive">Passwords don't match</p>
                  )}
                </div>

                {/* Strength indicator */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[8, 12, 16].map((threshold, i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            password.length >= threshold
                              ? i === 0
                                ? "bg-red-500"
                                : i === 1
                                ? "bg-yellow-500"
                                : "bg-green-500"
                              : "bg-border"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {password.length < 8
                        ? "Too short"
                        : password.length < 12
                        ? "Acceptable"
                        : password.length < 16
                        ? "Good"
                        : "Strong"}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !password || !confirm || password !== confirm}
                  className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-primary/20"
                >
                  {loading ? "Updating password…" : "Update password"}
                </button>
              </form>
            </div>
          )}

          {/* Success */}
          {pageState === "success" && (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-green-500"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <path d="m9 11 3 3L22 4" />
                </svg>
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Password updated</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your password has been changed. Redirecting you to sign in…
                </p>
              </div>
              <Link
                href="/"
                className="inline-block text-sm text-primary hover:underline"
              >
                Go to sign in now
              </Link>
            </div>
          )}
        </div>

        {pageState === "form" && (
          <p className="text-center text-sm text-muted-foreground">
            <Link
              href="/"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
              Back to sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
