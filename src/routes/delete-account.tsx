// Public web account-deletion page — required by Google Play's account
// deletion policy: users must be able to request deletion from a WEB resource
// without reinstalling the app (the in-app flow alone is not sufficient).
// This URL goes into the Play Console "Data deletion" field:
//   https://auroraperformancestudio.com/delete-account
//
// Signed-in users delete immediately via the same endpoint the mobile app
// uses (POST /api/public/account-delete). Signed-out visitors are shown what
// deletion does and a sign-in link — the page itself stays publicly viewable.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/delete-account")({
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const armed = confirmText.trim().toUpperCase() === "DELETE";

  const handleDelete = async () => {
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Your session expired — please sign in again.");
        return;
      }
      const res = await fetch("/api/public/account-delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Account deletion failed — please try again.");
        return;
      }
      await supabase.auth.signOut();
      toast.success("Your account and creations have been permanently deleted.");
      navigate({ to: "/" });
    } catch {
      setError("Account deletion failed — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="aurora-page-shell">
      <div className="aurora-ambient" />
      <div className="relative z-10 flex flex-col min-h-[100dvh] max-w-lg mx-auto px-5 pb-16">
        <div className="pt-6 pb-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Aurora
          </Link>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-300" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Delete your account</h1>
        </div>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-white/70">
          <p>
            Deleting your Aurora account is <span className="text-white">permanent</span>. It
            removes:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your account and sign-in (email, passkeys, sessions)</li>
            <li>Every creation — images, videos, audio, avatars, and uploads</li>
            <li>Your remaining Aura balance (it cannot be restored or transferred)</li>
            <li>Your generation history and app activity</li>
          </ul>
          <p>
            We retain only what the law requires: payment records (financial regulations) and
            records of your acceptance of our terms (legal evidence). These contain no media or
            creative content. See our{" "}
            <Link to="/legal/$slug" params={{ slug: "privacy" }} className="text-white underline">
              Privacy Policy
            </Link>{" "}
            for details.
          </p>
          <p className="text-white/50">
            You can also delete your account inside the Aurora Studio mobile app: Account →
            Delete Account.
          </p>
        </div>

        {loading ? (
          <div className="mt-10 flex items-center gap-2 text-white/50 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking your session…
          </div>
        ) : !user ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-white/70">
              To delete your account, first sign in so we can verify it&apos;s really you.
            </p>
            <Link
              to="/auth"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-white text-black text-sm font-medium px-5 py-2.5 hover:bg-white/90 transition-colors"
            >
              Sign in to continue
            </Link>
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-red-500/25 bg-red-500/5 p-5">
            <p className="text-sm text-white/70">
              Signed in as <span className="text-white">{user.email}</span>. Type{" "}
              <span className="font-mono text-red-300">DELETE</span> to confirm:
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="mt-3 w-full rounded-xl bg-black/30 border border-white/15 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-red-400/60"
            />
            <button
              onClick={handleDelete}
              disabled={!armed || busy}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-sm font-medium px-5 py-2.5 transition-colors hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {busy ? "Deleting…" : "Permanently delete my account"}
            </button>
            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
