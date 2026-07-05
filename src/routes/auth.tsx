import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, LogIn } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — Aurora Studio" },
      { name: "description", content: "Sign in or create an Aurora Studio account. 5 free Aura on signup." },
      { property: "og:title", content: "Sign in to Aurora Studio" },
      { property: "og:description", content: "Sign in or create an Aurora account. New creators get 5 free Aura." },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/auth" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/auth" }],
  }),
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

  useEffect(() => {
    if (!loading && session) navigate({ to: "/studio" });
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
        // Persist display_name to the profiles row (handle_new_user trigger creates it without name)
        const uid = data.user?.id;
        const name = displayName.trim() || email.split("@")[0];
        if (uid) {
          await supabase.from("profiles").update({ display_name: name }).eq("user_id", uid);
        }
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
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });

      if (result.error) {
        throw result.error;
      }

      if (result.redirected) {
        // Browser will redirect automatically
        return;
      }

      toast.success("Signed in with Google!");
      navigate({ to: "/studio" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--gradient-soft)] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-stage)" }} />
      <div className="relative w-full max-w-md rounded-3xl bg-card/80 backdrop-blur-xl border border-border p-8 shadow-[var(--shadow-glow)]">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <Sparkles className="size-4" /> Aurora Studio
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          {mode === "signup" ? "Create account" : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "signup" ? "Start directing your own studio shoots." : "Sign in to enter the studio."}
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
          <Button type="submit" disabled={busy} className="w-full h-11 text-base font-medium" style={{ background: "var(--gradient-hero)" }}>
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
        <button
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="mt-6 text-sm text-muted-foreground hover:text-foreground w-full text-center"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
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
