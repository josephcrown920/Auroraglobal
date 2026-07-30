import { createLazyFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, ExternalLink, Fingerprint, Loader2, LogOut, Music2, Plus, Shield, Trash2, UserCircle2, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useBiometricSupport } from "@/hooks/use-biometric-support";
import { getMyTiktokAccount, initTiktokConnect, disconnectTiktok } from "@/lib/tiktok-posting.functions";
import {
  beginPasskeyRegistration,
  completePasskeyRegistration,
  listPasskeys,
  deletePasskey,
} from "@/lib/webauthn.functions";
import { MobileNav } from "@/components/MobileNav";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createLazyFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/settings" }) as { tiktok?: string; msg?: string };
  const qc = useQueryClient();

  const getAccountFn = useServerFn(getMyTiktokAccount);
  const initConnectFn = useServerFn(initTiktokConnect);
  const disconnectFn = useServerFn(disconnectTiktok);

  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Show toast from OAuth callback redirect params.
  useEffect(() => {
    if (search.tiktok === "connected") {
      toast.success("TikTok account connected!");
      qc.invalidateQueries({ queryKey: ["tiktok-account"] });
    } else if (search.tiktok === "cancelled") {
      toast("TikTok connection cancelled.");
    } else if (search.tiktok === "error") {
      toast.error(`TikTok connection failed: ${search.msg ?? "unknown error"}`);
    }
  }, [search.tiktok, search.msg]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: tiktokAccount, isLoading: tiktokLoading } = useQuery({
    queryKey: ["tiktok-account"],
    queryFn: () => getAccountFn(),
    enabled: !!user,
  });

  const connectMut = useMutation({
    mutationFn: async () => {
      setConnecting(true);
      const res = await initConnectFn();
      window.location.href = res.authUrl;
    },
    onError: (e) => {
      setConnecting(false);
      toast.error(e instanceof Error ? e.message : "Failed to start TikTok connection");
    },
  });

  const disconnectMut = useMutation({
    mutationFn: () => disconnectFn(),
    onSuccess: () => {
      toast.success("TikTok account disconnected.");
      qc.invalidateQueries({ queryKey: ["tiktok-account"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to disconnect"),
  });

  // ── Sign-in methods (Face ID / fingerprint) ────────────────────────────────
  const biometricSupported = useBiometricSupport();
  const [addBusy, setAddBusy] = useState(false);

  const passkeysQ = useQuery({
    queryKey: ["passkeys"],
    queryFn: () => listPasskeys(),
    enabled: !!user,
  });

  const deletePasskeyMut = useMutation({
    mutationFn: (id: string) => deletePasskey({ data: { id } }),
    onSuccess: () => {
      toast.success("Sign-in method removed.");
      qc.invalidateQueries({ queryKey: ["passkeys"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to remove sign-in method"),
  });

  const addPasskey = async () => {
    setAddBusy(true);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const { options, challengeId } = await beginPasskeyRegistration({
        data: { origin: window.location.origin },
      });
      const credential = await startRegistration(options);
      const ua = navigator.userAgent;
      const deviceName = ua.includes("iPhone") ? "iPhone"
        : ua.includes("iPad") ? "iPad"
        : ua.includes("Android") ? "Android device"
        : ua.includes("Mac") ? "Mac"
        : ua.includes("Windows") ? "Windows PC"
        : "This device";
      const res = await completePasskeyRegistration({
        data: { challengeId, credential, origin: window.location.origin, deviceName },
      });
      if (res.alreadyRegistered) {
        toast.info("This device is already set up for Face ID / fingerprint.");
      } else {
        toast.success("Face ID / fingerprint saved — use it next time you sign in.");
      }
      qc.invalidateQueries({ queryKey: ["passkeys"] });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[passkey] registration failed:", name, msg);
      // User dismissed the native prompt — stay silent
      if (name === "NotAllowedError" || /cancel|abort/i.test(msg)) return;
      if (name === "InvalidStateError") {
        toast.info("This device is already set up for Face ID / fingerprint.");
        return;
      }
      toast.error(msg || "Couldn't set up Face ID / fingerprint — try again.");
    } finally {
      setAddBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const tiktok = tiktokAccount;

  return (
    <div className="aurora-page-shell text-foreground min-h-screen">
      <div className="aurora-ambient" />
      <MobileNav />

      <main className="relative mx-auto max-w-2xl px-4 pb-20 pt-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate({ to: "/dashboard" })}
            className="aurora-glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back
          </button>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        {/* Account */}
        <section className="aurora-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <UserCircle2 className="size-4 text-primary" /> Account
          </div>
          <div className="text-sm text-muted-foreground">{user.email}</div>
        </section>

        {/* Sign-in methods (Face ID / fingerprint) */}
        <section className="aurora-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Fingerprint className="size-4 text-primary" /> Sign-in methods
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Sign in faster with Face ID, Touch ID, or your fingerprint — no password needed.
          </p>

          {passkeysQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : (passkeysQ.data ?? []).length > 0 ? (
            <ul className="space-y-2">
              {(passkeysQ.data ?? []).map((pk) => (
                <li key={pk.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                  <Fingerprint className="size-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{pk.device_name ?? "Passkey"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Added {new Date(pk.created_at).toLocaleDateString()}
                      {pk.last_used_at ? ` · Last used ${new Date(pk.last_used_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${pk.device_name ?? "passkey"}`}
                    onClick={() => {
                      if (window.confirm("Remove this sign-in method? You can add it again anytime.")) {
                        deletePasskeyMut.mutate(pk.id);
                      }
                    }}
                    disabled={deletePasskeyMut.isPending}
                    className="ml-auto flex size-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {deletePasskeyMut.isPending && deletePasskeyMut.variables === pk.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No Face ID or fingerprint set up on any device yet.</p>
          )}

          {biometricSupported ? (
            <button
              type="button"
              onClick={addPasskey}
              disabled={addBusy}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {addBusy ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
              Add Face ID / fingerprint
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Face ID / fingerprint isn't available in this browser — open Aurora on a phone or laptop with
              biometrics to set it up.
            </p>
          )}
        </section>

        {/* TikTok Connection */}
        <section className="aurora-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Music2 className="size-4 text-[#25F4EE]" />
            <h2 className="text-sm font-semibold">TikTok</h2>
            <a
              href="https://developers.tiktok.com/doc/content-posting-api-get-started"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Docs <ExternalLink className="size-3" />
            </a>
          </div>

          {tiktokLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : tiktok?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {tiktok.avatarUrl && (
                  <img
                    src={tiktok.avatarUrl}
                    alt={tiktok.displayName ?? "TikTok"}
                    className="size-10 rounded-full border border-border object-cover"
                  />
                )}
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {tiktok.displayName ?? tiktok.username ?? "Connected"}
                  </p>
                  {tiktok.username && (
                    <p className="text-xs text-muted-foreground">@{tiktok.username}</p>
                  )}
                </div>
                <CheckCircle2 className="size-4 text-emerald-400 ml-auto flex-shrink-0" />
              </div>

              {tiktok.sessionExpired && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
                  Your TikTok session has expired. Reconnect to keep posting.
                </div>
              )}

              <p className="text-xs text-muted-foreground leading-relaxed">
                Connected — videos you post will start as <strong className="text-foreground">private</strong> so you can
                review them on TikTok before publishing. You can change the privacy setting there before posting to your
                followers.
              </p>

              <div className="flex gap-2">
                {tiktok.sessionExpired && (
                  <button
                    type="button"
                    onClick={() => connectMut.mutate()}
                    disabled={connecting || connectMut.isPending}
                    className="inline-flex items-center gap-2 rounded-full bg-[#25F4EE]/20 border border-[#25F4EE]/30 px-4 py-2 text-xs font-semibold text-[#25F4EE] hover:bg-[#25F4EE]/30 disabled:opacity-50"
                  >
                    {connecting ? <Loader2 className="size-3 animate-spin" /> : <Music2 className="size-3" />}
                    Reconnect TikTok
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => disconnectMut.mutate()}
                  disabled={disconnectMut.isPending}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
                >
                  {disconnectMut.isPending ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <X className="size-3" />
                  )}
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Connect your TikTok account to post finished videos directly from Aurora — no manual
                downloading and uploading needed. Videos start as <strong className="text-foreground">private</strong>
                {" "}so you can review them before they go live.
              </p>
              <button
                type="button"
                onClick={() => connectMut.mutate()}
                disabled={connecting || connectMut.isPending}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#25F4EE] to-[#FE2C55] px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-90 disabled:opacity-50"
              >
                {connecting || connectMut.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Music2 className="size-4" />
                )}
                Connect TikTok
              </button>
              {connectMut.error && (
                <p className="text-xs text-destructive">
                  {connectMut.error instanceof Error ? connectMut.error.message : "Connection failed"}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Legal */}
        <section className="aurora-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="size-4 text-primary" /> Legal
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <Link to="/legal/$slug" params={{ slug: "terms" }} className="hover:text-foreground underline-offset-4 hover:underline">Terms</Link>
            <Link to="/legal/$slug" params={{ slug: "privacy" }} className="hover:text-foreground underline-offset-4 hover:underline">Privacy</Link>
            <Link to="/legal/$slug" params={{ slug: "ai-policy" }} className="hover:text-foreground underline-offset-4 hover:underline">AI Policy</Link>
          </div>
        </section>

        {/* Sign out */}
        <section className="aurora-card rounded-2xl p-5">
          <button
            type="button"
            onClick={async () => {
              const { supabase: sb } = await import("@/integrations/supabase/client");
              await sb.auth.signOut();
              navigate({ to: "/" });
            }}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </section>
      </main>

      <SiteFooter tone="dark" />
    </div>
  );
}
