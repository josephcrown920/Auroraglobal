import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Clock, ExternalLink, Fingerprint, Loader2, LogOut, Music2, Plus, RefreshCw, RotateCcw, Shield, Trash2, UserCircle2, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useBiometricSupport } from "@/hooks/use-biometric-support";
import { getMyTiktokAccount, initTiktokConnect, disconnectTiktok, listMyTiktokPosts, pollTiktokPostStatus, retryTiktokPost } from "@/lib/tiktok-posting.functions";
import {
  beginPasskeyRegistration,
  completePasskeyRegistration,
  listPasskeys,
  deletePasskey,
} from "@/lib/webauthn.functions";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createLazyFileRoute("/settings")({ component: SettingsPage });

type TiktokPostRow = Awaited<ReturnType<typeof listMyTiktokPosts>>[number];

const TERMINAL_TIKTOK_STATUSES = new Set(["publish_complete", "failed", "publish_from_creator_fail"]);
const isTerminalTiktokStatus = (status: string) => TERMINAL_TIKTOK_STATUSES.has(status);

// Live-status policy: poll TikTok for non-terminal rows at most every 30s,
// and give up on rows older than 10 minutes (they get a manual Check button).
const POLL_MAX_AGE_MS = 10 * 60_000;
const POLL_THROTTLE_MS = 30_000;
const isPollableTiktokPost = (p: TiktokPostRow) =>
  !isTerminalTiktokStatus(p.status) &&
  !!p.publishId &&
  Date.now() - new Date(p.createdAt).getTime() < POLL_MAX_AGE_MS;

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
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
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
    queryKey: ["tiktok-account", user?.id],
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

  // ── TikTok post history ────────────────────────────────────────────────────
  const listPostsFn = useServerFn(listMyTiktokPosts);
  const pollPostFn = useServerFn(pollTiktokPostStatus);
  const retryPostFn = useServerFn(retryTiktokPost);

  const postsQ = useQuery({
    queryKey: ["tiktok-posts", user?.id],
    queryFn: () => listPostsFn(),
    enabled: !!user && !!tiktokAccount?.connected,
    refetchInterval: (query) => {
      const rows = query.state.data;
      return Array.isArray(rows) && rows.some(isPollableTiktokPost) ? 15_000 : false;
    },
  });

  // Refresh eligible non-terminal rows from TikTok, throttled to one call per
  // row per POLL_THROTTLE_MS; rows past POLL_MAX_AGE_MS stop auto-refreshing.
  const lastPolledRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const rows = postsQ.data ?? [];
    const now = Date.now();
    const due = rows.filter((p) => isPollableTiktokPost(p) && now - (lastPolledRef.current.get(p.id) ?? 0) > POLL_THROTTLE_MS);
    if (due.length === 0) return;
    due.forEach((p) => lastPolledRef.current.set(p.id, now));
    let cancelled = false;
    void (async () => {
      const results = await Promise.allSettled(due.map((p) => pollPostFn({ data: { postId: p.id } })));
      if (!cancelled && results.some((r) => r.status === "fulfilled")) {
        qc.invalidateQueries({ queryKey: ["tiktok-posts"] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postsQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const retryPostMut = useMutation({
    mutationFn: (p: TiktokPostRow) => retryPostFn({ data: { postId: p.id } }),
    onSuccess: () => {
      toast.success("Retrying — TikTok is processing the video again.");
      qc.invalidateQueries({ queryKey: ["tiktok-posts"] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Retry failed");
      qc.invalidateQueries({ queryKey: ["tiktok-posts"] });
    },
  });

  const checkStatusMut = useMutation({
    mutationFn: (postId: string) => pollPostFn({ data: { postId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tiktok-posts"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't refresh status"),
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

        {/* TikTok Post History */}
        {tiktok?.connected && (
          <section className="aurora-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-[#25F4EE]" />
              <h2 className="text-sm font-semibold">TikTok posts</h2>
              {postsQ.isFetching && !postsQ.isLoading && (
                <Loader2 className="size-3 animate-spin text-muted-foreground ml-auto" />
              )}
            </div>

            {postsQ.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            ) : (postsQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                Nothing posted yet — videos you share to TikTok will show up here with their status.
              </p>
            ) : (
              <ul className="space-y-2">
                {(postsQ.data ?? []).map((p) => {
                  const posted = p.status === "publish_complete";
                  const failed = p.status === "failed" || p.status === "publish_from_creator_fail";
                  const stuck = !posted && !failed && !isPollableTiktokPost(p);
                  return (
                    <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                      <div className="relative size-12 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                        <Music2 className="absolute inset-0 m-auto size-4 text-muted-foreground" />
                        <video
                          src={p.videoUrl}
                          muted
                          playsInline
                          preload="metadata"
                          className="relative h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{p.title || "Untitled video"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(p.createdAt).toLocaleString()}
                          {posted && p.postedAt ? ` · Live since ${new Date(p.postedAt).toLocaleDateString()}` : ""}
                        </p>
                        {failed && p.errorMsg && (
                          <p className="mt-0.5 text-[11px] text-red-300/80 line-clamp-2">{p.errorMsg}</p>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            posted
                              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                              : failed
                                ? "border-red-400/30 bg-red-400/10 text-red-400"
                                : stuck
                                  ? "border-border bg-muted text-muted-foreground"
                                  : "border-amber-400/30 bg-amber-400/10 text-amber-300"
                          }`}
                        >
                          {posted ? (
                            <CheckCircle2 className="size-3" />
                          ) : failed ? (
                            <X className="size-3" />
                          ) : stuck ? (
                            <Clock className="size-3" />
                          ) : (
                            <Loader2 className="size-3 animate-spin" />
                          )}
                          {posted ? "Posted" : failed ? "Failed" : stuck ? "Stuck?" : "Posting…"}
                        </span>
                        {stuck && (
                          <button
                            type="button"
                            onClick={() => checkStatusMut.mutate(p.id)}
                            disabled={checkStatusMut.isPending}
                            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-50"
                          >
                            {checkStatusMut.isPending && checkStatusMut.variables === p.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <RefreshCw className="size-3" />
                            )}
                            Check
                          </button>
                        )}
                        {failed && (
                          <button
                            type="button"
                            onClick={() => retryPostMut.mutate(p)}
                            disabled={retryPostMut.isPending}
                            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-50"
                          >
                            {retryPostMut.isPending && retryPostMut.variables?.id === p.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <RotateCcw className="size-3" />
                            )}
                            Retry
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

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
