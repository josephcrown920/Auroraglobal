import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackSignUp } from "@/lib/gtm";

export const Route = createLazyFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const OAUTH_SIGNUP_INTENT_KEY = "aurora.oauth_signup_intent";
  useEffect(() => {
    if (loading || !session) return;
    if (typeof window !== "undefined" && sessionStorage.getItem(OAUTH_SIGNUP_INTENT_KEY)) {
      sessionStorage.removeItem(OAUTH_SIGNUP_INTENT_KEY);
      trackSignUp("google");
    }
    navigate({ to: "/studio" });
  }, [session, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/studio`,
            data: { display_name: displayName.trim() || email.split("@")[0] },
          },
        });
        if (error) throw error;
        const uid = data.user?.id;
        const name = displayName.trim() || email.split("@")[0];
        if (uid) {
          await supabase.from("profiles").update({ display_name: name }).eq("user_id", uid);
        }
        trackSignUp("email");
        if (data.session) {
          toast.success(`Welcome, ${name}!`);
          navigate({ to: "/studio" });
        } else {
          toast.success("Check your email to confirm your account");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/studio" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    try {
      if (mode === "signup" && typeof window !== "undefined") {
        sessionStorage.setItem(OAUTH_SIGNUP_INTENT_KEY, "1");
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/studio`,
        },
      });
      if (error) {
        if (typeof window !== "undefined") sessionStorage.removeItem(OAUTH_SIGNUP_INTENT_KEY);
        throw error;
      }
      // Supabase will redirect the page to Google — keep button busy
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setGoogleBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-zinc-950 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 65% 25%, oklch(0.58 0.22 25 / 0.10), transparent 55%), radial-gradient(ellipse at 20% 80%, oklch(0.085 0.022 272 / 0.6), transparent 50%)" }} />
      <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 ring-1 ring-white/8 p-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-100 transition-colors mb-6">
          <span className="inline-block size-1.5 rounded-full bg-brand" />
          <span className="text-xs font-semibold uppercase tracking-widest">Aurora Studio</span>
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          {mode === "signup" ? "Create account" : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "signup" ? "The studio built by pro artists, for artists ready to scale. Start directing your own shoots." : "Sign in to enter the studio."}
        </p>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">What should we call you?</Label>
              <Input
                id="name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your first name or stage name"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full h-11 rounded-xl text-base font-semibold bg-brand text-white hover:bg-brand/90 border-0">
            {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>
        <div className="mt-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={googleBusy}
          onClick={handleGoogleSignIn}
          className="mt-3 w-full h-11"
        >
          {googleBusy ? "Signing in..." : <><LogIn className="mr-2 size-4" /> Continue with Google</>}
        </Button>
        <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="hover:text-foreground"
          >
            {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
          {mode === "signin" && (
            <button
              type="button"
              className="hover:text-foreground"
              onClick={async () => {
                if (!email) { toast.error("Enter your email above first"); return; }
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/auth`,
                });
                if (error) toast.error(error.message);
                else toast.success("Password reset email sent — check your inbox");
              }}
            >
              Forgot password?
            </button>
          )}
        </div>
        <p className="mt-6 text-[11px] text-center text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to="/legal/$slug" params={{ slug: "terms" }} className="underline">
            Terms
          </Link>
          ,{" "}
          <Link to="/legal/$slug" params={{ slug: "privacy" }} className="underline">
            Privacy Policy
          </Link>
          , and{" "}
          <Link to="/legal/$slug" params={{ slug: "ai-policy" }} className="underline">
            AI Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
