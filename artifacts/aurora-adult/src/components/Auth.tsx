import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, UserPlus } from "lucide-react";

export function Auth() {
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "sign_in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Account created — check your email to confirm, then sign in.");
        setMode("sign_in");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050207] px-6 py-12">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-rose-900/10 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-violet-900/8 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[400px]">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-rose-800 shadow-[0_0_40px_rgba(225,29,106,0.45)]">
            <ShieldCheck size={28} className="text-white" />
          </div>
          <h1 className="text-[28px] font-black tracking-tight text-white">Adult School</h1>
          <p className="mt-1.5 text-[14px] text-white/40">Your content. Your control. Complete discretion.</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-8 backdrop-blur-sm">
          {/* Mode toggle */}
          <div className="mb-6 grid grid-cols-2 gap-1.5 rounded-xl bg-white/5 p-1">
            {(["sign_in", "sign_up"] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`rounded-lg py-2 text-[13px] font-bold capitalize transition-all ${mode === m ? "bg-rose-500/20 text-rose-300 shadow-sm" : "text-white/30 hover:text-white"}`}>
                {m === "sign_in" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            {/* Email */}
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-white/40">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-white/8 bg-white/4 py-3 pl-10 pr-4 text-[14px] text-white placeholder:text-white/20 outline-none focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-white/40">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type={showPw ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/8 bg-white/4 py-3 pl-10 pr-11 text-[14px] text-white placeholder:text-white/20 outline-none focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20 transition-all"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 py-3.5 text-[15px] font-black text-white shadow-[0_0_32px_rgba(225,29,106,0.35)] transition-all hover:shadow-[0_0_48px_rgba(225,29,106,0.5)] hover:scale-[1.01] disabled:opacity-60 disabled:scale-100"
            >
              {loading
                ? <Loader2 size={16} className="animate-spin" />
                : mode === "sign_in" ? <Lock size={15} /> : <UserPlus size={15} />}
              {mode === "sign_in" ? "Sign in securely" : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[12px] text-white/25">
          🔒 Zero public indexing · Private by default · Part of{" "}
          <a href="/" className="text-rose-400 no-underline hover:text-rose-300 transition-colors font-semibold">Aurora</a>
        </p>
      </div>
    </div>
  );
}
