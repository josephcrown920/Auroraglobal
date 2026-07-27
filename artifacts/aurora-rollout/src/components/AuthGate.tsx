import { useState } from "react";
import { Music, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Props {
  onSuccess: () => void;
}

export function AuthGate({ onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "magic">("signin");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      toast.error("Auth service not available");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      toast.error("Auth service not available");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href },
      });
      if (error) throw error;
      toast.success("Magic link sent — check your email");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--background)" }}>
      {/* Ambient */}
      <div
        style={{
          position: "fixed", top: -200, left: "50%", transform: "translateX(-50%)",
          width: 600, height: 600, borderRadius: "50%",
          background: "oklch(0.45 0.18 300 / 0.15)", filter: "blur(120px)",
          pointerEvents: "none", zIndex: 0,
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="glass rounded-2xl p-8 border border-[--primary]/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 rounded-xl bg-[--primary] flex items-center justify-center">
              <Music className="size-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold">Aurora Rollout</h1>
              <p className="text-xs text-[--muted-foreground]">Music Video Campaign Studio</p>
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-1">Sign in to continue</h2>
          <p className="text-sm text-[--muted-foreground] mb-6">
            Use your existing Aurora account — or{" "}
            <a
              href={`${window.location.origin}/auth`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[--primary] hover:underline inline-flex items-center gap-1"
            >
              create one on Aurora <ExternalLink className="size-3" />
            </a>
          </p>

          {mode === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[--muted-foreground]">Email</label>
                <Input
                  type="email"
                  placeholder="artist@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[--muted-foreground]">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" variant="premium" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[--muted-foreground]">Email</label>
                <Input
                  type="email"
                  placeholder="artist@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <Button type="submit" variant="premium" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Send magic link"}
              </Button>
            </form>
          )}

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "magic" : "signin")}
              className="text-xs text-[--muted-foreground] hover:text-[--foreground] transition-colors"
            >
              {mode === "signin" ? "Sign in with magic link instead" : "Sign in with password instead"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
