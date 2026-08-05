import { useState } from "react";
import { Eye, EyeOff, Loader2, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const SK = "aurora_adult_admin_unlocked";

export function isAdminUnlocked() {
  try { return sessionStorage.getItem(SK) === "1"; } catch { return false; }
}

function setAdminUnlocked() {
  try { sessionStorage.setItem(SK, "1"); } catch { /* private browsing */ }
}

interface Props { onUnlocked: () => void; }

export function AdminGate({ onUnlocked }: Props) {
  const [passcode, setPasscode] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // Validate passcode server-side so the secret is never sent to the client.
      const res = await fetch("/api/admin/verify-passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        toast.error(data.error ?? "Incorrect passcode");
        setPasscode("");
        return;
      }
      setAdminUnlocked();
      onUnlocked();
    } catch {
      toast.error("Could not reach verification server — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050207] px-6 py-12">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-rose-900/10 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-violet-900/8 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[360px]">
        {/* Icon + heading */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10">
            <ShieldAlert size={22} className="text-rose-400" />
          </div>
          <h1 className="text-[22px] font-black tracking-tight text-white">Admin access only</h1>
          <p className="mt-1 text-[13px] text-white/35">Adult School · Operator portal</p>
        </div>

        {/* Form */}
        <form onSubmit={submit}
          className="rounded-3xl border border-white/8 bg-white/[0.03] p-7 backdrop-blur-sm">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-white/35">
              Passcode
            </label>
            <div className="relative">
              <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                type={showPw ? "text" : "password"}
                required
                autoFocus
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/8 bg-white/4 py-3 pl-10 pr-11 text-[14px] text-white placeholder:text-white/20 outline-none focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20 transition-all"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white transition-colors">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 py-3 text-[14px] font-black text-white shadow-[0_0_28px_rgba(225,29,106,0.3)] transition-all hover:shadow-[0_0_42px_rgba(225,29,106,0.45)] hover:scale-[1.01] disabled:opacity-60 disabled:scale-100">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            Unlock studio
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] text-white/20">
          This tool is restricted to Aurora operators.
        </p>
      </div>
    </div>
  );
}
