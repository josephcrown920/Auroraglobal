/**
 * "Post to TikTok" button for a finished video generation.
 *
 * Shows:
 *  - "Post to TikTok" when not yet posted
 *  - Spinner while posting / uploading
 *  - "Posted ✓" badge when publish_complete
 *  - Error badge with retry on failure
 *
 * If the user hasn't connected TikTok it shows a link to /settings instead.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  postToTiktok,
  pollTiktokPostStatus,
  getTiktokPostForGeneration,
} from "@/lib/tiktok-posting.functions";

type PostStatus =
  | "idle"
  | "posting"
  | "processing_upload"
  | "processing_download"
  | "processing_media_edit"
  | "processing_stabilize"
  | "publish_complete"
  | "publish_from_creator_fail"
  | "failed";

const TERMINAL: PostStatus[] = ["publish_complete", "publish_from_creator_fail", "failed"];
const PROCESSING: PostStatus[] = [
  "posting",
  "processing_upload",
  "processing_download",
  "processing_media_edit",
  "processing_stabilize",
];

interface Props {
  videoUrl: string;
  generationId?: string;
  title?: string;
  /** Whether the user already has a connected TikTok account. Pass undefined while loading. */
  isConnected: boolean | undefined;
  /** Visual size variant. */
  compact?: boolean;
}

export function TiktokPostButton({
  videoUrl,
  generationId,
  title,
  isConnected,
  compact = false,
}: Props) {
  const postFn = useServerFn(postToTiktok);
  const pollFn = useServerFn(pollTiktokPostStatus);
  const getPostFn = useServerFn(getTiktokPostForGeneration);

  const [postId, setPostId] = useState<string | null>(null);
  const [status, setStatus] = useState<PostStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // On mount, check if there's already a post for this generation.
  useEffect(() => {
    if (!generationId) return;
    getPostFn({ data: { generationId } })
      .then((row: { postId: string; status: string; errorMsg: string | null; postedAt: string | null } | null) => {
        if (!row) return;
        setPostId(row.postId);
        setStatus(row.status as PostStatus);
        setErrorMsg(row.errorMsg);
      })
      .catch(() => {});
  }, [generationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable ref to hold the polling interval so it can be cleared on unmount.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear on unmount to avoid state updates on an unmounted component.
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Poll status while in a processing state.
  const poll = useCallback(
    (id: string) => {
      if (!id) return;
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      let rounds = 0;
      intervalRef.current = setInterval(async () => {
        rounds++;
        if (rounds > 120) {
          // ~10 min max
          if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null; }
          return;
        }
        try {
          const res = await pollFn({ data: { postId: id } });
          const s = res.status as PostStatus;
          setStatus(s);
          setErrorMsg(res.errorMsg ?? null);
          if (TERMINAL.includes(s)) {
            if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null; }
            if (s === "publish_complete") {
              toast.success("Posted to TikTok ✓");
            } else {
              toast.error(`TikTok post failed: ${res.errorMsg ?? "unknown error"}`);
            }
          }
        } catch {
          if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null; }
        }
      }, 5000);
    },
    [pollFn],
  );

  async function handlePost() {
    if (isConnected === false) return;
    setStatus("posting");
    setErrorMsg(null);
    try {
      const res = await postFn({
        data: {
          videoUrl,
          generationId,
          title: title?.slice(0, 150),
          privacyLevel: "SELF_ONLY", // default to private so user can review before publishing
        },
      });
      setPostId(res.postId);
      setStatus("processing_upload");
      poll(res.postId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to post";
      setStatus("failed");
      setErrorMsg(msg);
      toast.error(msg);
    }
  }

  async function handleRetry() {
    setStatus("idle");
    setErrorMsg(null);
    setPostId(null);
    await handlePost();
  }

  // Not yet loaded — don't render anything yet.
  if (isConnected === undefined) return null;

  // User hasn't connected TikTok — show a link to settings.
  if (!isConnected) {
    return (
      <Link
        to="/settings"
        search={{ tiktok: "connect", msg: undefined }}
        className={
          compact
            ? "inline-flex items-center gap-1 rounded-lg border border-border bg-background/70 px-2 py-1 text-[10px] font-semibold text-muted-foreground backdrop-blur hover:text-foreground"
            : "inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-foreground/30 hover:text-foreground"
        }
      >
        <ExternalLink className="size-3" />
        Connect TikTok
      </Link>
    );
  }

  if (status === "publish_complete") {
    return (
      <span
        className={
          compact
            ? "inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-400"
            : "inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400"
        }
      >
        <CheckCircle2 className="size-3" />
        Posted ✓
      </span>
    );
  }

  if ((status === "failed" || status === "publish_from_creator_fail") && errorMsg) {
    return (
      <button
        type="button"
        onClick={handleRetry}
        title={errorMsg}
        className={
          compact
            ? "inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/20"
            : "inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
        }
      >
        <AlertCircle className="size-3" />
        TikTok failed — retry
      </button>
    );
  }

  if (PROCESSING.includes(status)) {
    const label =
      status === "posting"
        ? "Sending…"
        : status === "processing_upload" || status === "processing_download"
          ? "Uploading…"
          : "Processing…";
    return (
      <span
        className={
          compact
            ? "inline-flex items-center gap-1 rounded-lg bg-[#25F4EE]/10 px-2 py-1 text-[10px] font-semibold text-[#25F4EE]/80"
            : "inline-flex items-center gap-1.5 rounded-xl bg-[#25F4EE]/10 px-3 py-1.5 text-xs font-semibold text-[#25F4EE]/80"
        }
      >
        <Loader2 className="size-3 animate-spin" />
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handlePost}
      className={
        compact
          ? "inline-flex items-center gap-1 rounded-lg border border-[#25F4EE]/30 bg-[#25F4EE]/10 px-2 py-1 text-[10px] font-semibold text-[#25F4EE] hover:bg-[#25F4EE]/20"
          : "inline-flex items-center gap-1.5 rounded-xl border border-[#25F4EE]/30 bg-[#25F4EE]/10 px-3 py-1.5 text-xs font-semibold text-[#25F4EE] hover:bg-[#25F4EE]/20"
      }
    >
      <Send className="size-3" />
      Post to TikTok
    </button>
  );
}

/** Convenience variant that also starts polling for an existing postId. */
export function useTiktokPostPoller(postId: string | null, onComplete?: (status: PostStatus) => void) {
  const pollFn = useServerFn(pollTiktokPostStatus);
  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    const t = setInterval(async () => {
      if (cancelled) return;
      try {
        const res = await pollFn({ data: { postId } });
        const s = res.status as PostStatus;
        if (TERMINAL.includes(s)) {
          clearInterval(t);
          onComplete?.(s);
        }
      } catch { clearInterval(t); }
    }, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps
}
