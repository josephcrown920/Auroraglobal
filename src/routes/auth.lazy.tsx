import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { parseAuthReturnPath } from "@/lib/auth-return-path";
import { classifyAuthError, describeAuthError, type ClassifiedAuthError } from "@/lib/auth-error-message";
import { useAuth } from "@/hooks/use-auth";
import { hasBackendEnv } from "@/integrations/backend-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Github, MailCheck, Fingerprint, Loader2, Eye, EyeOff, KeyRound, Mic2, Clapperboard, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { triggerLifecycleEmail } from "@/lib/emails.functions";

/** Asked once, on the signup form. Decides which side of the studio opens by
 *  default and how tools are ranked. Stored on profiles.persona. */
const AUTH_UNAVAILABLE_MESSAGE =
  "Sign-in isn't available on this deployment right now. Please try again later.";

const PERSONA_OPTIONS = [
  { id: "artist" as const,  label: "Artist",  blurb: "Music, performance, visuals.", Icon: Mic2 },
  { id: "creator" as const, label: "Creator", blurb: "UGC, short-form, ads.",        Icon: Clapperboard },
];

// Apple doesn't ship an icon in lucide — inline the official logo mark.
function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 814 1000" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 376.7 0 290.9 0 209.3c0-150.8 98.3-230.6 194.9-230.6 51.5 0 94.2 33.9 126.7 33.9 30.9 0 79.5-35.8 140.2-35.8 22.6 0 108.2 2 170.5 82.2zm-170.5-82.2c-28.6-35.1-70.8-60.6-117.1-60.6-71.3 0-119.4 44.5-155.5 44.5-34.6 0-83.2-41.4-141.2-41.4-87.5 0-182.8 68.7-182.8 218.3 0 131.5 60.6 285.3 141.2 382.6 67.8 82.2 130.1 148.4 214.5 148.4 74.3 0 95.5-40.8 175.1-40.8 79.5 0 95.5 40.8 175.1 40.8 84.4 0 149.3-70.2 214.5-148.4 55.5-66.8 90.8-162.9 93-165.2-2.6-.6-170.5-65.2-170.5-236.1 0-146.5 120.5-208.2 126.7-211.4z"/>
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.5h3.2c1.9-1.8 3.1-4.4 3.1-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 .9-3.5.9-2.7 0-5-1.8-5.8-4.3H2.9v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.2 13.7A6 6 0 0 1 5.9 12c0-.6.1-1.2.3-1.7V7.7H2.9A10 10 0 0 0 2 12c0 1.6.4 3.1.9 4.3l3.3-2.6Z" />
      <path fill="#EA4335" d="M12 6c1.7 0 3.2.6 4.4 1.8l3-3A10 10 0 0 0 2.9 7.7l3.3 2.6C7 7.8 9.3 6 12 6Z" />
    </svg>
  );
}
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackSignUp } from "@/lib/gtm";
import {
  beginPasskeyRegistration,
  completePasskeyRegistration,
  beginPasskeyAuthentication,
  completePasskeyAuthentication,
} from "@/lib/webauthn.functions";

export const Route = createLazyFileRoute("/auth")({
  component: AuthPage,
});

import { useBiometricSupport, useEmbeddedBrowser } from "@/hooks/use-biometric-support";

function AuthPage() {
  const navigate = useNavigate();
  const sendSignupWelcome = useServerFn(triggerLifecycleEmail);
  const { session, loading } = useAuth();
  const search = Route.useSearch();
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  // New signups land in Studio (the product); returning sign-ins land on Home.
  const returnTo = search.next ?? "/studio";
  // TanStack Router treats `to` as a pathname only — query/hash must be passed
  // separately or a deep link like /video-agent-edit?id=… fails to match.
  const navigateToReturnPath = useCallback(() => {
    const parsed = parseAuthReturnPath(returnTo);
    void navigate({ to: parsed.pathname, search: parsed.search, hash: parsed.hash } as never);
  }, [navigate, returnTo]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [persona, setPersona] = useState<"artist" | "creator" | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [githubBusy, setGithubBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Last email/password failure, rendered inline under the password field.
  // Toasts alone were missed on phones (hidden under the keyboard / auto-
  // dismissed), which made a wrong password look like the form did nothing.
  const [formError, setFormError] = useState<ClassifiedAuthError | null>(null);
  // Bumped whenever the form changes (field edit, mode switch, resubmit). A
  // submit that started under an older value must not paint its error over a
  // form the user has since edited.
  const formRevision = useRef(0);
  const clearFormError = useCallback(() => {
    formRevision.current += 1;
    setFormError(null);
  }, []);
  const [resetBusy, setResetBusy] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const biometricSupported = useBiometricSupport();
  const embeddedBrowser = useEmbeddedBrowser();
  // The Supabase client throws on first use when its env is missing. Rather
  // than crash the page (or let the form spin), say so up front.
  const authAvailable = hasBackendEnv();
  // Passkeys only work in a real browser tab — in-app/embedded webviews deny
  // the Face ID prompt before we can authenticate.
  const canUsePasskeys = biometricSupported && !embeddedBrowser;
  // Which OAuth providers are actually enabled on the Supabase project.
  // Clicking a disabled provider's button just errors with "provider is not
  // enabled", so we ask Supabase's public settings endpoint and only render
  // buttons for providers that will actually work. `null` = unknown (fetch
  // pending/failed) — in that case we fall back to showing every button
  // rather than hiding a working provider behind a transient network error.
  const [enabledProviders, setEnabledProviders] = useState<Record<string, boolean> | null>(null);
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    const controller = new AbortController();
    void fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { external?: Record<string, boolean> } | null) => {
        if (json?.external && typeof json.external === "object") {
          setEnabledProviders(json.external);
        }
      })
      .catch(() => {
        /* unknown — keep showing all buttons */
      });
    return () => controller.abort();
  }, []);
  const providerEnabled = (name: "google" | "github" | "apple") =>
    enabledProviders === null || enabledProviders[name] === true;
  const anyOAuthEnabled = providerEnabled("google") || providerEnabled("github") || providerEnabled("apple");

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Detect Supabase password-recovery links (#...type=recovery) so we show
  // the "set a new password" form instead of bouncing to the studio.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setRecoveryMode(true);
    }
    if (!authAvailable) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [authAvailable]);

  // OAuth providers and Supabase's own auth server report failures (denied
  // consent, expired/invalid code, misconfigured provider, etc.) by
  // redirecting back here with `error`/`error_description` in the query
  // string or the hash fragment — never as a thrown exception this
  // component would otherwise see. Without this, the user just lands back
  // on a blank sign-in form with no indication anything went wrong.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);
    const error = hashParams.get("error") ?? queryParams.get("error");
    if (!error) return;
    const description = hashParams.get("error_description") ?? queryParams.get("error_description");
    toast.error(description ? description.replace(/\+/g, " ") : `Sign-in failed: ${error}`);
    // Strip the error params so a refresh (or the redirect-back-to-/studio
    // effect above) doesn't re-show the same toast or leak it into history.
    const url = new URL(window.location.href);
    url.hash = "";
    for (const key of ["error", "error_description", "error_code"]) url.searchParams.delete(key);
    window.history.replaceState(null, "", url.toString());
  }, []);

  const OAUTH_SIGNUP_INTENT_KEY = "aurora.oauth_signup_intent";
  useEffect(() => {
    if (loading || !session || recoveryMode) return;
    let cancelled = false;

    void (async () => {
      let isNewOAuthAccount = false;
      if (typeof window !== "undefined") {
        const provider = sessionStorage.getItem(OAUTH_SIGNUP_INTENT_KEY);
        if (provider) {
          sessionStorage.removeItem(OAUTH_SIGNUP_INTENT_KEY);
          trackSignUp(provider as "google" | "github" | "apple");
          isNewOAuthAccount = true;
        }
      }

      // A passkey enrollment must finish before navigating away. Previously we
      // started the native Face ID prompt and immediately left /auth, which
      // caused iOS to cancel the prompt without saving a credential.
      if (isNewOAuthAccount && canUsePasskeys) {
        await offerPasskeyRegistration();
      }
      if (!cancelled) navigateToReturnPath();
    })();

    return () => { cancelled = true; };
  }, [session, loading, recoveryMode, canUsePasskeys, navigateToReturnPath]);

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
      toast.error(describeAuthError(err, "Could not send reset email"));
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
      navigateToReturnPath();
    } catch (err) {
      toast.error(describeAuthError(err, "Could not update password"));
    } finally {
      setRecoveryBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFormError();
    const revision = formRevision.current;
    if (!authAvailable) {
      toast.error(AUTH_UNAVAILABLE_MESSAGE);
      setFormError({ kind: "unavailable", message: AUTH_UNAVAILABLE_MESSAGE });
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(search.next ?? "/studio")}`,
            // persona is read back out of user_metadata when the profile row is
            // first created, so it survives the email-confirmation round trip.
            data: { display_name: displayName.trim() || email.split("@")[0], persona },
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
          // Send the welcome message immediately for signups that do not
          // require an email-confirmation round trip. The server-side dedupe
          // guard makes retries harmless.
          void sendSignupWelcome({ data: { template: "signup_welcome" } }).catch(() => {});
          toast.success(`Welcome, ${name}!`);
          // After signup, offer to register a passkey
          if (canUsePasskeys) {
            await offerPasskeyRegistration();
          }
          navigateToReturnPath();
        } else {
          setConfirmSent(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigateToReturnPath();
      }
    } catch (err) {
      const classified = classifyAuthError(
        err,
        mode === "signup" ? "Could not create your account" : "Sign-in failed",
      );
      toast.error(classified.message);
      if (formRevision.current === revision) setFormError(classified);
    } finally {
      setBusy(false);
    }
  };

  // Shared OAuth helper — handles frame detection, intent tracking, redirect.
  const handleOAuth = async (
    provider: "google" | "github" | "apple",
    setBusy: (v: boolean) => void,
  ) => {
    if (!authAvailable) {
      toast.error(AUTH_UNAVAILABLE_MESSAGE);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup" && typeof window !== "undefined") {
        sessionStorage.setItem(OAUTH_SIGNUP_INTENT_KEY, provider);
      }
      const isInFrame = typeof window !== "undefined" && window.self !== window.top;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(search.next ?? "/studio")}`,
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
      const label = provider === "google" ? "Google" : provider === "apple" ? "Apple" : "GitHub";
      toast.error(describeAuthError(err, `${label} sign-in failed`));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn  = () => handleOAuth("google", setGoogleBusy);
  const handleGithubSignIn = () => handleOAuth("github", setGithubBusy);
  const handleAppleSignIn  = () => handleOAuth("apple",  setAppleBusy);

  // Register a passkey for the currently signed-in user
  async function offerPasskeyRegistration() {
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const { options, challengeId } = await beginPasskeyRegistration({
        data: { origin: window.location.origin },
      });
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
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      const message = err instanceof Error ? err.message : String(err);
      // A dismissed native prompt is a normal choice, not an application
      // failure. Other errors need to be visible so a broken passkey setup
      // never looks like it succeeded.
      if (name === "NotAllowedError" || name === "AbortError" || /cancel|abort/i.test(message)) {
        return;
      }
      toast.error(message || "Couldn't enable Face ID / fingerprint. You can try again in Settings.");
    }
  }

  // Sign in using a passkey (Face ID / fingerprint)
  const handleBiometricSignIn = async () => {
    setBioBusy(true);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const { options, challengeId } = await beginPasskeyAuthentication({
        data: { origin: window.location.origin },
      });
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
      navigateToReturnPath();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const errName = err instanceof Error ? err.name : "";
      // The browser/platform denied, dismissed, or aborted the Face ID
      // prompt. This is ALSO what embedded/in-app browsers throw when they
      // block WebAuthn, so never fail silently — tell the user how to fix it.
      if (
        errName === "NotAllowedError" ||
        errName === "AbortError" ||
        msg.includes("abort") ||
        msg.toLowerCase().includes("notallowed") ||
        msg.includes("not allowed") ||
        msg.includes("cancelled") ||
        msg.includes("cancel") ||
        msg.includes("timed out")
      ) {
        toast.info(
          "Face ID was cancelled or blocked by this browser. If you opened Aurora inside another app, open this page in Safari (or Chrome) and try again — or sign in with your password below.",
          { duration: 8000 },
        );
        return;
      }
      // No passkey registered yet for this device
      if (
        msg.includes("not recognised") ||
        msg.includes("not recognized") ||
        msg.includes("No credentials") ||
        msg.includes("no credentials") ||
        msg.includes("email first")
      ) {
        toast.error(
          "No Face ID / fingerprint saved yet. Sign in with your password first, then enable biometrics in Settings.",
          { duration: 6000 }
        );
        return;
      }
      // No passkeys at all on this device for this domain
      if (
        msg.includes("no available") ||
        msg.includes("no passkey") ||
        msg.includes("NotSupportedError") ||
        msg.includes("InvalidStateError")
      ) {
        toast.error(
          "This device has no saved passkey for Aurora. Sign in with your password, then set up Face ID in Settings.",
          { duration: 6000 }
        );
        return;
      }
      toast.error(msg || "Biometric sign-in failed — try your password instead.");
    } finally {
      setBioBusy(false);
    }
  };

  if (recoveryMode) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--gradient-soft)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-stage)" }} />
        <div className="relative w-full max-w-md rounded-3xl bg-card/80 backdrop-blur-xl border border-border p-8 shadow-[var(--shadow-glow)]">
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
            <Button type="submit" disabled={recoveryBusy} className="w-full h-11 rounded-xl text-base font-semibold text-white border-0 hover:opacity-90" style={{ background: "var(--gradient-hero)" }}>
              {recoveryBusy ? "Saving…" : "Save new password"}
            </Button>
          </form>
        </div>
      </main>
    );
  }

  if (confirmSent) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--gradient-soft)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-stage)" }} />
        <div className="relative w-full max-w-md rounded-3xl bg-card/80 backdrop-blur-xl border border-border p-8 text-center shadow-[var(--shadow-glow)]">
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
    <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--gradient-soft)] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-stage)" }} />
      <div className="relative w-full max-w-md rounded-3xl bg-card/80 backdrop-blur-xl border border-border p-8 shadow-[var(--shadow-glow)]">
        <Link to="/" className="inline-flex flex-col gap-0.5 mb-5 group">
          <span className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Aurora Performance Studio</span>
          </span>
          <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-muted-foreground/60 pl-6">For Artists &amp; Creators</span>
        </Link>

        {/* Mode tab switcher */}
        <div className="flex rounded-xl bg-white/[0.05] border border-white/5 p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMode("signin"); clearFormError(); }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "signin"
                ? "bg-white/[0.1] text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); clearFormError(); }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "signup"
                ? "bg-white/[0.1] text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Create account
          </button>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          {mode === "signup" ? "Join the studio" : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "signup" ? "Built by pro artists, for creators ready to scale." : "Sign in to continue."}
        </p>

        {/* Embedded/in-app browser: passkeys are blocked by the platform, so
            instead of a Face ID button that can only fail, explain the fix.
            Password + GitHub/Apple sign-in below still work here. */}
        {embeddedBrowser && mode === "signin" && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
            <Fingerprint className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-snug text-muted-foreground">
              Face ID sign-in doesn't work inside this app's browser. Open this
              page in <span className="font-semibold text-foreground">Safari</span>{" "}
              (or Chrome) to use Face ID — or sign in with your password below.
            </p>
          </div>
        )}

        {/* Biometric sign-in button — visible when browser supports it */}
        {canUsePasskeys && mode === "signin" && (
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

        {!authAvailable && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-xs leading-snug text-foreground"
          >
            {AUTH_UNAVAILABLE_MESSAGE}
          </div>
        )}

        <form
          onSubmit={submit}
          data-auth-form="password"
          data-hydrated={hydrated ? "true" : "false"}
          className="space-y-4"
        >
          {mode === "signup" && (
            <div className="space-y-2">
              <Label>Which one are you?</Label>
              <div className="grid grid-cols-2 gap-2">
                {PERSONA_OPTIONS.map((opt) => {
                  const active = persona === opt.id;
                  const OptIcon = opt.Icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => { setPersona(opt.id); clearFormError(); }}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        active
                          ? "border-primary bg-primary/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/25"
                      }`}
                    >
                      <OptIcon className={`size-5 mb-2 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="text-sm font-semibold leading-none">{opt.label}</p>
                      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{opt.blurb}</p>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                We'll set your studio up for this — you can flip between both any time.
              </p>
            </div>
          )}
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">What should we call you?</Label>
              <Input
                id="name"
                type="text"
                required
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); clearFormError(); }}
                placeholder="Your first name or stage name"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFormError();
              }}
            />
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
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFormError();
                }}
                aria-invalid={formError ? true : undefined}
                aria-describedby={formError ? "auth-form-error-message" : undefined}
                className="pr-12 [&::-ms-reveal]:hidden [&::-webkit-contacts-auto-fill-button]:hidden"
              />
              {/* 44×44 touch target so the toggle is reliably tappable on mobile */}
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 -translate-y-1/2 z-10 flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors touch-manipulation"
              >
                {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
              </button>
            </div>
          </div>
          {/* Persistent inline failure — stays until a field is edited or the
              form is resubmitted. role=alert is itself an assertive live
              region, so no extra aria-live wrapper (it would announce twice). */}
          {formError && (
            <div
              id="auth-form-error"
              role="alert"
              data-auth-error={formError.kind}
              className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2.5 text-sm leading-snug text-red-100"
            >
              <p id="auth-form-error-message">{formError.message}</p>
              {formError.kind === "invalid_credentials" && (
                <button
                  type="button"
                  disabled={resetBusy}
                  onClick={handleForgotPassword}
                  className="mt-1.5 inline-flex min-h-9 items-center gap-1.5 font-semibold text-white underline underline-offset-2 disabled:opacity-60 touch-manipulation"
                >
                  {resetBusy && <Loader2 className="size-3.5 animate-spin" />}
                  {resetBusy ? "Sending reset email…" : "Forgot password? Email me a reset link"}
                </button>
              )}
            </div>
          )}
          <Button
            type="submit"
            disabled={!hydrated || busy || !authAvailable || (mode === "signup" && !persona)}
            className="w-full h-11 rounded-xl text-base font-semibold text-white border-0 hover:opacity-90"
            style={{ background: "var(--gradient-hero)" }}
          >
            {!hydrated
              ? "Loading…"
              : busy
              ? "Working…"
              : mode === "signup"
                ? persona
                  ? "Create account"
                  : "Pick artist or creator to continue"
                : "Sign in"}
          </Button>
        </form>

        {/* After signup: prompt to add biometrics */}
        {canUsePasskeys && mode === "signup" && (
          <p className="mt-3 text-[11px] text-center text-muted-foreground">
            After you create your account, we'll ask if you want to enable Face ID / fingerprint sign-in.
          </p>
        )}

        {anyOAuthEnabled && (
          <div className="mt-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        )}
        {providerEnabled("google") && (
          <Button
            type="button"
            variant="outline"
            disabled={googleBusy}
            onClick={handleGoogleSignIn}
            className="mt-3 w-full h-11"
          >
            {googleBusy ? "Signing in..." : <><GoogleIcon className="mr-2 size-4" /> Continue with Google</>}
          </Button>
        )}
        {providerEnabled("github") && (
          <Button
            type="button"
            variant="outline"
            disabled={githubBusy}
            onClick={handleGithubSignIn}
            className="mt-2 w-full h-11"
          >
            {githubBusy ? "Signing in..." : <><Github className="mr-2 size-4" /> Continue with GitHub</>}
          </Button>
        )}
        {providerEnabled("apple") && (
          <Button
            type="button"
            disabled={appleBusy}
            onClick={handleAppleSignIn}
            className="mt-2 w-full h-11 bg-black hover:bg-zinc-900 text-white border border-zinc-700"
          >
            {appleBusy ? "Signing in..." : <><AppleIcon className="mr-2 size-4" /> Continue with Apple</>}
          </Button>
        )}

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
