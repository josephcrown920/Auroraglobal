import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Github, MailCheck, Fingerprint, Loader2, Eye, EyeOff, KeyRound } from "lucide-react";

// Apple doesn't ship an icon in lucide — inline the official logo mark.
function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 814 1000" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 376.7 0 290.9 0 209.3c0-150.8 98.3-230.6 194.9-230.6 51.5 0 94.2 33.9 126.7 33.9 30.9 0 79.5-35.8 140.2-35.8 22.6 0 108.2 2 170.5 82.2zm-170.5-82.2c-28.6-35.1-70.8-60.6-117.1-60.6-71.3 0-119.4 44.5-155.5 44.5-34.6 0-83.2-41.4-141.2-41.4-87.5 0-182.8 68.7-182.8 218.3 0 131.5 60.6 285.3 141.2 382.6 67.8 82.2 130.1 148.4 214.5 148.4 74.3 0 95.5-40.8 175.1-40.8 79.5 0 95.5 40.8 175.1 40.8 84.4 0 149.3-70.2 214.5-148.4 55.5-66.8 90.8-162.9 93-165.2-2.6-.6-170.5-65.2-170.5-236.1 0-146.5 120.5-208.2 126.7-211.4z"/>
    </svg>
  );
}
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackSignUp } from "@/lib/gtm";
import {
  beginPasskeyRegistration,
  completePasskeyRegistration,
  beginPasskeyAuthentication,
  completePasskeyAuthentication,
} from "@/lib/webauthn.server";

export const Route = createLazyFileRoute("/auth")({
  component: AuthPage,
});

// Detect browser WebAuthn platform-authenticator support
function useBiometricSupport() {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.PublicKeyCredential ||
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function"
    ) return;
    window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      .then(setSupported)
      .catch(() => setSupported(false));
  }, []);
  return supported;
}

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [githubBusy, setGithubBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const biometricSupported = useBiometricSupport();
  const abortRef = useRef<AbortController | null>(null);

  // Detect Supabase password-recovery links (#...type=recovery) so we show
  // the "set a new password" form instead of bouncing to the studio.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setRecoveryMode(true);
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const OAUTH_SIGNUP_INTENT_KEY = "aurora.oauth_signup_intent";
  useEffect(() => {
    if (loading || !session || recoveryMode) return;
    if (typeof window !== "undefined") {
      const provider = sessionStorage.getItem(OAUTH_SIGNUP_INTENT_KEY);
      if (provider) {
        sessionStorage.removeItem(OAUTH_SIGNUP_INTENT_KEY);
        trackSignUp(provider as "github" | "apple");
      }
    }
    navigate({ to: "/home" });
  }, [session, loading, navigate, recoveryMode]);

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Enter your email above first");
      return;
    }
    setResetBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success("Password reset email sent — check your inbox");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setResetBusy(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setRecoveryBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated — you're signed in!");
      setRecoveryMode(false);
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setRecoveryBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/home`,
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
          // After signup, offer to register a passkey
          if (biometricSupported) {
            void offerPasskeyRegistration();
          }
          navigate({ to: "/home" });
        } else {
          setConfirmSent(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/home" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  // Shared OAuth helper — handles frame detection, intent tracking, redirect.
  const handleOAuth = async (
    provider: "github" | "apple",
    setBusy: (v: boolean) => void,
  ) => {
    setBusy(true);
    try {
      if (mode === "signup" && typeof window !== "undefined") {
        sessionStorage.setItem(OAUTH_SIGNUP_INTENT_KEY, provider);
      }
      const isInFrame = typeof window !== "undefined" && window.self !== window.top;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/home`,
          skipBrowserRedirect: isInFrame,
        },
      });
      if (error) {
        if (typeof window !== "undefined") sessionStorage.removeItem(OAUTH_SIGNUP_INTENT_KEY);
        throw error;
      }
      if (isInFrame && data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        toast.info("Complete sign-in in the new tab, then come back here.");
      }
    } catch (err) {
      const label = provider === "apple" ? "Apple" : "GitHub";
      toast.error(err instanceof Error ? err.message : `${label} sign-in failed`);
    } finally {
      setBusy(false);
    }
  };

  const handleGithubSignIn = () => handleOAuth("github", setGithubBusy);
  const handleAppleSignIn  = () => handleOAuth("apple",  setAppleBusy);

  // Register a passkey for the currently signed-in user
  async function offerPasskeyRegistration() {
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const { options, challengeId } = await beginPasskeyRegistration();
      const credential = await startRegistration(options);
      await completePasskeyRegistration({
        data: {
          challengeId,
          credential,
          origin: window.location.origin,
          deviceName: navigator.userAgent.includes("iPhone")
            ? "iPhone"
            : navigator.userAgent.includes("Mac")
              ? "Mac"
              : "This device",
        },
      });
      toast.success("Face ID / fingerprint saved — use it next time you sign in.");
    } catch {
      // Non-blocking — user can always add it later from settings
    }
  }

  // Sign in using a passkey (Face ID / fingerprint)
  const handleBiometricSignIn = async () => {
    setBioBusy(true);
    abortRef.current = new AbortController();
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const rpID = window.location.hostname;

      const { options, challengeId } = await beginPasskeyAuthentication({ data: { rpID } });
      const credential = await startAuthentication(options, false);

      const { token_hash } = await completePasskeyAuthentication({
        data: { challengeId, credential, origin: window.location.origin },
      });

      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: "magiclink",
      });
      if (error) throw error;

      toast.success("Signed in with biometrics!");
      navigate({ to: "/home" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("cancelled") || msg.includes("abort") || msg.includes("NotAllowed")) {
        return; // User dismissed — silent
      }
      toast.error(msg || "Biometric sign-in failed");
    } finally {
      setBioBusy(false);
    }
  };

  if (recoveryMode) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-zinc-950 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 65% 25%, oklch(0.58 0.22 25 / 0.10), transparent 55%), radial-gradient(ellipse at 20% 80%, oklch(0.085 0.022 272 / 0.6), transparent 50%)" }} />
        <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 ring-1 ring-white/8 p-8">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/25">
            <KeyRound className="size-7 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-center">Set a new password</h2>
          <p className="mt-2 mb-6 text-sm text-muted-foreground text-center">
            Choose a new password for your account.
          </p>
          <form onSubmit={handleSetNewPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-11"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={recoveryBusy} className="w-full h-11 rounded-xl text-base font-semibold bg-brand text-white hover:bg-brand/90 border-0">
              {recoveryBusy ? "Saving…" : "Save new password"}
            </Button>
          </form>
        </div>
      </main>
    );
  }

  if (confirmSent) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-zinc-950 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 65% 25%, oklch(0.58 0.22 25 / 0.10), transparent 55%), radial-gradient(ellipse at 20% 80%, oklch(0.085 0.022 272 / 0.6), transparent 50%)" }} />
        <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 ring-1 ring-white/8 p-8 text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/25">
            <MailCheck className="size-7 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Check your inbox</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to{" "}
            <strong className="text-foreground">{email}</strong>.{" "}
            Click it to activate your account — you'll land straight in the studio.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Didn't get it? Check your spam folder or wait a minute, then try again.
          </p>
          <button
            type="button"
            onClick={() => { setConfirmSent(false); setMode("signin"); }}
            className="mt-6 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            ← Back to sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-zinc-950 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 65% 25%, oklch(0.58 0.22 25 / 0.10), transparent 55%), radial-gradient(ellipse at 20% 80%, oklch(0.085 0.022 272 / 0.6), transparent 50%)" }} />
      <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 ring-1 ring-white/8 p-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-100 transition-colors mb-5">
          <span className="inline-block size-1.5 rounded-full bg-brand" />
          <span className="text-xs font-semibold uppercase tracking-widest">Aurora Studio</span>
        </Link>

        {/* Mode tab switcher */}
        <div className="flex rounded-xl bg-zinc-800/70 p-1 mb-6">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "signin"
                ? "bg-zinc-700 text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "signup"
                ? "bg-zinc-700 text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Create account
          </button>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight mb-1">
          {mode === "signup" ? "Join the studio" : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "signup" ? "Built by pro artists, for creators ready to scale." : "Sign in to continue."}
        </p>

        {/* Biometric sign-in button — visible when browser supports it */}
        {biometricSupported && mode === "signin" && (
          <Button
            type="button"
            onClick={handleBiometricSignIn}
            disabled={bioBusy}
            className="w-full h-12 mb-4 rounded-xl text-base font-semibold bg-primary text-white hover:bg-primary/90 border-0 flex items-center justify-center gap-2"
          >
            {bioBusy ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Fingerprint className="size-5" />
            )}
            {bioBusy ? "Checking…" : "Sign in with Face ID / Fingerprint"}
          </Button>
        )}

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
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-11"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={busy} className="w-full h-11 rounded-xl text-base font-semibold bg-brand text-white hover:bg-brand/90 border-0">
            {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>

        {/* After signup: prompt to add biometrics */}
        {biometricSupported && mode === "signup" && (
          <p className="mt-3 text-[11px] text-center text-muted-foreground">
            After you create your account, we'll ask if you want to enable Face ID / fingerprint sign-in.
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={githubBusy}
          onClick={handleGithubSignIn}
          className="mt-3 w-full h-11"
        >
          {githubBusy ? "Signing in..." : <><Github className="mr-2 size-4" /> Continue with GitHub</>}
        </Button>
        <Button
          type="button"
          disabled={appleBusy}
          onClick={handleAppleSignIn}
          className="mt-2 w-full h-11 bg-black hover:bg-zinc-900 text-white border border-zinc-700"
        >
          {appleBusy ? "Signing in..." : <><AppleIcon className="mr-2 size-4" /> Continue with Apple</>}
        </Button>

        <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
          <span />
          {mode === "signin" && (
            <button
              type="button"
              disabled={resetBusy}
              className="hover:text-foreground disabled:opacity-60 inline-flex items-center gap-1.5"
              onClick={handleForgotPassword}
            >
              {resetBusy && <Loader2 className="size-3.5 animate-spin" />}
              {resetBusy ? "Sending…" : "Forgot password?"}
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
