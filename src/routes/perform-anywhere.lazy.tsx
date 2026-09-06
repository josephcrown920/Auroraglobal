import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Crown, Sparkles, Upload, Zap } from "lucide-react";

const MODELS = ["Seedance 5.9", "Kling", "Gemini Omni", "Grok Imagine"];

export const Route = createLazyFileRoute("/perform-anywhere")({
  component: PerformAnywhere,
});

function PerformAnywhere() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0b0a17] text-white">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#0b0a17]/85 px-5 py-3 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2 text-sm font-bold text-white no-underline"><span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-violet-600"><Sparkles size={14} /></span>Aurora</Link>
        <div className="flex gap-2"><Link to="/scene-builder" className="hidden rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/60 no-underline hover:text-white sm:inline-flex">Scene Builder</Link><Link to="/motion" className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-4 py-2 text-xs font-bold text-white no-underline"><Upload size={13} /> Upload your clip</Link></div>
      </header>
      <section className="relative overflow-hidden px-5 pb-16 pt-16 text-center sm:pt-24">
        <img src="/hero/hero-perform-anywhere.png" alt="" className="pointer-events-none absolute right-[-8%] top-0 h-full max-h-[760px] w-auto opacity-20 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative mx-auto max-w-3xl">
          <div className="mx-auto mb-5 inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-200"><Crown size={11} /> Premium feature · Motion Control AI</div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-fuchsia-300">● Perform Anywhere</p>
          <h1 className="mt-5 text-5xl font-black leading-[1.02] tracking-[-0.05em] sm:text-7xl">Film yourself anywhere.<br /><span className="bg-gradient-to-r from-fuchsia-300 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">Aurora builds the world.</span></h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/55 sm:text-lg">Motion Control reads your real movement from a 30-second phone clip and transfers it into an AI-generated cinematic scene — style, energy, identity.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">{MODELS.map((model) => <span key={model} className="rounded-full border border-fuchsia-400/25 bg-fuchsia-400/10 px-3 py-1.5 text-[10px] font-bold text-fuchsia-200">● {model}</span>)}</div>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><Link to="/motion" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-6 py-3.5 text-sm font-bold text-white no-underline shadow-[0_0_35px_rgba(168,85,247,0.3)]"><Upload size={17} /> Upload your performance clip</Link><Link to="/scene-builder" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3.5 text-sm font-semibold text-white/70 no-underline hover:text-white"><Sparkles size={16} /> Open Scene Builder</Link></div>
          <p className="mt-3 text-xs text-white/35">30-second phone recording · any room · starts at 5 Aura</p>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-5 pb-20">
        <div className="grid items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[1fr_auto_1fr] md:p-5">
          <DemoCard src="/josh/generated2/perform-phone-clip.webp" label="What you provide" title="Phone performance" body="Your real movement is the source." />
          <div className="flex flex-col items-center gap-2 text-fuchsia-300"><div className="flex size-12 items-center justify-center rounded-full border border-fuchsia-400/50 bg-fuchsia-400/15"><Zap size={21} /></div><span className="text-[9px] uppercase tracking-[0.2em] text-white/40">Motion<br />Control</span></div>
          <DemoCard src="/josh/generated2/viral-10-performance.webp" label="Rendered output" title="Cinematic result" body="Identity and energy preserved in the new world." highlighted />
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="mx-auto mb-8 max-w-xl text-center"><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-fuchsia-300">How it works</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Three steps. Full cinematic output.</h2></div>
        <div className="grid gap-4 md:grid-cols-3">{[
          ["01", "Record yourself on your phone", "30 seconds. Any room. Sing, dance, rap — no studio needed.", null],
          ["02", "Build your scene in Scene Builder", "Pick a neon stage, luxury set, rooftop, or any world you can imagine.", "/scene-builder"],
          ["03", "Orchestrate your final video", "Drop your phone clip and scene into Motion Control and let Aurora transfer the performance.", "/motion"],
        ].map(([number, title, body, href]) => <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="flex items-start justify-between"><span className="text-2xl">{number === "01" ? "📱" : number === "02" ? "🎨" : "🎬"}</span><span className="text-4xl font-black text-white/10">{number}</span></div><h3 className="mt-5 text-base font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-white/45">{body}</p>{href && <Link to={href} className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-fuchsia-300 no-underline">Open tool <ArrowRight size={12} /></Link>}</div>)}</div>
      </section>
      <section className="mx-auto max-w-4xl px-5 pb-24"><div className="rounded-3xl border border-fuchsia-400/25 bg-gradient-to-br from-fuchsia-400/10 to-violet-600/10 p-7 sm:p-10"><div className="grid gap-3 sm:grid-cols-2">{["Real motion transfer — no green screen", "Identity locked across every frame", "Cinematic 9:16 portrait output", "No studio. No crew. No budget.", "30-second clip is all you need", "Secure payment via Paystack"].map((item) => <div key={item} className="flex items-center gap-2.5 text-sm text-white/75"><span className="flex size-5 items-center justify-center rounded-full border border-fuchsia-400/30 bg-fuchsia-400/15"><Check size={11} className="text-fuchsia-300" /></span>{item}</div>)}</div></div></section>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-5 text-xs text-white/40"><Link to="/" className="flex items-center gap-1.5 text-white/50 no-underline"><Sparkles size={13} className="text-fuchsia-300" /> Aurora Performance Studio</Link><div className="flex gap-4"><Link to="/motion" className="text-white/40 no-underline hover:text-white">Motion Control</Link><Link to="/scene-builder" className="text-white/40 no-underline hover:text-white">Scene Builder</Link><Link to="/colors" className="text-white/40 no-underline hover:text-white">Colors Studio</Link></div></footer>
    </main>
  );
}

function DemoCard({ src, label, title, body, highlighted = false }: { src: string; label: string; title: string; body: string; highlighted?: boolean }) {
  return <div className={`overflow-hidden rounded-2xl border ${highlighted ? "border-fuchsia-400/50 shadow-[0_0_50px_rgba(168,85,247,0.18)]" : "border-white/10"} bg-white/[0.03]`}><img src={src} alt={title} className="aspect-video w-full object-cover" loading="lazy" /><div className="p-4"><p className="text-[9px] font-bold uppercase tracking-widest text-fuchsia-300">{label}</p><h3 className="mt-2 text-base font-bold">{title}</h3><p className="mt-1 text-xs text-white/45">{body}</p></div></div>;
}