// Model card roster — shared/visible to ALL signed-in creators.
// No generation content is shown here; galleries are private per-creator
// and live inside ModelStudio.

import { ArrowRight, Camera, LogOut, Sparkles } from "lucide-react";
import type { Model } from "@/lib/models";
import { MODELS } from "@/lib/models";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface Props {
  user: User;
  onSelectModel: (model: Model) => void;
}

export function ModelGrid({ user, onSelectModel }: Props) {
  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#050207] text-white antialiased">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-rose-900/10 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-violet-900/8 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center justify-between border-b border-white/6 bg-[#050207]/90 px-5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-rose-800 shadow-[0_0_14px_rgba(225,29,106,0.5)]">
            <Camera size={13} className="text-white" />
          </div>
          <span className="text-[14px] font-black tracking-tight">Adult School</span>
          <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-rose-400 ring-1 ring-rose-500/20">
            Studio
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-white/30 hidden sm:block truncate max-w-[180px]">
            {user.email}
          </span>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-lg border border-white/8 px-2.5 py-1 text-[11px] text-white/35 transition-colors hover:text-white"
          >
            <LogOut size={11} /> Sign out
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-5 py-10">
        {/* Title */}
        <div className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-400">
            Model Studios
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Choose a model to shoot
          </h1>
          <p className="mt-2 text-[13px] text-white/35">
            All models are available to every creator. Your generated shots stay private to you.
          </p>
        </div>

        {/* Model grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MODELS.map((model) => (
            <ModelCard key={model.id} model={model} onOpen={onSelectModel} />
          ))}
        </div>

        {/* Footer hint */}
        <p className="mt-10 text-center text-[11px] text-white/20">
          <Sparkles size={10} className="inline mr-1 text-rose-400" />
          Each studio generates identity-locked 8K editorial shots scoped privately to your account
        </p>
      </main>
    </div>
  );
}

function ModelCard({ model, onOpen }: { model: Model; onOpen: (m: Model) => void }) {
  return (
    <button
      onClick={() => onOpen(model)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] text-left transition-all duration-200 hover:border-rose-500/40 hover:shadow-[0_0_32px_rgba(225,29,106,0.12)]"
    >
      {/* Cover photo */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-white/5">
        <img
          src={model.cover}
          alt={model.name}
          className="size-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050207] via-[#050207]/20 to-transparent" />

        {model.tag && (
          <span className="absolute right-2.5 top-2.5 rounded-md bg-rose-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white shadow-sm">
            {model.tag}
          </span>
        )}

        {/* Open studio badge on hover */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 translate-y-1 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_0_20px_rgba(225,29,106,0.5)]">
            Open studio <ArrowRight size={10} />
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="p-4">
        <p className="text-[15px] font-bold text-white">{model.name}</p>
        <p className="mt-0.5 text-[11px] text-white/35">{model.niche}</p>
        <p className="mt-3 text-[10px] font-semibold text-rose-400/70 uppercase tracking-widest">
          {model.photos.length} reference photo{model.photos.length !== 1 ? "s" : ""} · 8 looks
        </p>
      </div>
    </button>
  );
}
