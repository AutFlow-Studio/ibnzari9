import { useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        toast({
          title: "Too many requests",
          description: body.error ?? "Please wait before requesting another reset link.",
          variant: "destructive",
        });
        return;
      }

      // Always show the same success message regardless of whether the email
      // exists — prevents user enumeration.
      setSubmitted(true);
    } catch {
      toast({
        title: "Something went wrong",
        description: "Unable to send reset email. Please try again.",
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
        <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-8 shadow-xl space-y-6">
          {submitted ? (
            <div className="space-y-4 text-center">
              {/* Success icon */}
              <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
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
                  className="text-primary"
                >
                  <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  <path d="m16 19 2 2 4-4" />
                </svg>
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Check your inbox</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If an account exists for <strong className="text-foreground">{email}</strong>,
                  we've sent a password reset link. It expires in 1 hour.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Didn't receive it? Check your spam folder or{" "}
                <button
                  onClick={() => setSubmitted(false)}
                  className="text-primary hover:underline"
                >
                  try again
                </button>
                .
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Forgot your password?</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@agency.com"
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all placeholder:text-muted-foreground/60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-primary/20"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
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
      </div>
    </div>
  );
}
