import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Check, ImageIcon, MousePointerClick, Film, Play, Terminal, Wand2 } from "lucide-react";
import shot1 from "@/assets/showcase-1.jpg";
import shot2 from "@/assets/showcase-2.jpg";
import shot3 from "@/assets/showcase-3.jpg";
import shot4 from "@/assets/showcase-4.jpg";
import shot5 from "@/assets/showcase-5.jpg";
import shot6 from "@/assets/showcase-6.jpg";

/* 1 ─ Supercomputer — a single prompt box that ships video, image, and edits */
export function SupercomputerSection() {
  const examples = [
    "red-lit studio performance, hanging silver mic, 5s video",
    "rooftop golden-hour cover, anamorphic flare, vertical",
    "remove background, replace with neon blue cyclorama",
  ];
  return (
    <section className="relative z-10 mx-4 md:mx-12 my-16 rounded-[32px] overflow-hidden border border-white/10 bg-gradient-to-br from-[#0c0820] via-[#0a0618] to-[#050410] animate-fade-in">
      <div className="absolute inset-0 pointer-events-none opacity-70"
        style={{ background: "radial-gradient(circle at 50% 0%, rgba(167,139,250,.25), transparent 60%)" }} />
      <div className="relative px-6 md:px-16 py-16 md:py-24">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full aurora-glass text-sm uppercase tracking-widest text-white/80">
            <Terminal className="size-3" /> Supercomputer
          </span>
          <h2 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight text-white">
            One prompt.
            <span className="block aurora-gradient-text">
              Video, image, edit.
            </span>
          </h2>
          <p className="mt-4 text-white/65 text-base md:text-lg max-w-xl mx-auto">
            Type what you want — a music-video shot, a portrait, an edit on an existing frame.
            Aurora picks the right model and ships it in seconds. No nodes, no presets, no learning curve.
          </p>
        </div>

        {/* Prompt box */}
        <div className="mt-10 max-w-2xl mx-auto">
          <Link to="/studio" className="block no-underline rounded-2xl border border-primary/40 bg-black/50 backdrop-blur-xl shadow-[var(--shadow-glow)] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-[13px] uppercase tracking-widest text-white/40">
              <span className="size-2 rounded-full bg-primary/70" />
              <span className="size-2 rounded-full bg-amber-300/70" />
              <span className="size-2 rounded-full bg-emerald-400/70" />
              <span className="ml-2">aurora · prompt</span>
            </div>
            <div className="px-5 py-5 flex items-center gap-3">
              <Wand2 className="size-4 text-primary shrink-0" />
              <span className="text-white/90 text-sm md:text-base leading-relaxed">
                make me a red-lit studio performance, hanging silver mic
                <span className="inline-block w-[2px] h-4 align-middle bg-primary ml-0.5 animate-pulse" />
              </span>
            </div>
            <div className="px-5 pb-4 flex flex-wrap gap-1.5">
              {examples.map((e) => (
                <span key={e} className="text-[13px] px-2 py-0.5 rounded-full bg-white/5 border border-border text-white/55">
                  {e}
                </span>
              ))}
            </div>
          </Link>
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            to="/studio"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-hero)] px-6 py-3.5 text-sm font-semibold text-white no-underline shadow-[var(--shadow-glow-soft)] hover:brightness-110"
          >
            <Sparkles className="size-4" /> Open Supercomputer <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* 2 ─ Marketing Studio — crimson radial */
export function MarketingStudioSection() {
  const cards = [
    { t: "Hyper Motion", d: "Pure CGI, product as hero", src: shot4 },
    { t: "Pro Virtual Try-On", d: "Street-style editorial energy", src: shot2, active: true },
    { t: "Product Review", d: "Hands-on demo, product detail", src: shot6 },
  ];
  return (
    <section className="relative z-10 mx-4 md:mx-12 my-16 rounded-[32px] overflow-hidden border border-white/10 animate-fade-in"
      style={{ background: "radial-gradient(circle at 50% 0%, #6b0f1f 0%, #2a0710 55%, #0a0306 100%)" }}>
      <div className="px-6 md:px-16 py-16">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 bg-white/10 text-sm uppercase tracking-widest text-white/85">
          <span className="px-1.5 py-0.5 rounded bg-white/15">New</span> Marketing Studio
        </span>
        <h2 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight text-white">
          ONE PROMPT, YOUR ENTIRE
          <span className="block text-white/70">CAMPAIGN</span>
        </h2>
        <p className="mt-4 text-white/70 max-w-2xl text-base md:text-lg">
          Studio-quality UGC, product demos, and video ads. Scroll-stopping content for every channel.
        </p>

        <ul className="mt-6 space-y-2.5">
          {[
            "Create your Avatar in 1 click",
            "Add an image of your product",
            "Generate a video",
          ].map((t) => (
            <li key={t} className="flex items-center gap-3 text-white/90">
              <span className="size-6 rounded-full bg-white/15 flex items-center justify-center">
                <Check className="size-3.5 text-white" />
              </span>
              {t}
            </li>
          ))}
        </ul>

        <div className="mt-10 grid grid-cols-3 gap-3 md:gap-5">
          {cards.map((c) => (
            <div
              key={c.t}
              className={`rounded-2xl overflow-hidden border ${
                c.active ? "border-white/40 shadow-[0_0_40px_-10px_rgba(255,255,255,0.4)]" : "border-white/10"
              } bg-gradient-to-b from-white/10 to-black/40`}
            >
              <div className="aspect-[3/4] bg-gradient-to-b from-white/30 to-black/30 relative">
                <img src={c.src} alt={c.t} className="size-full object-cover mix-blend-luminosity opacity-80" />
              </div>
              <div className="p-3 text-center">
                <p className={`text-sm ${c.active ? "text-white font-semibold" : "text-white/70"}`}>{c.t}</p>
                <p className="text-sm text-white/45 mt-0.5">{c.d}</p>
              </div>
            </div>
          ))}
        </div>

        <Link
          to="/ugc"
          className="mt-10 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-black hover:opacity-95 no-underline"
        >
          Open Marketing Studio <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}

/* 3 ─ Higgsfield-style Supercomputer card — blue gradient */
export function SupercomputerCard() {
  const agents = ["#7dd3fc", "#f472b6", "#86efac", "#c4b5fd", "#fda4af"];
  return (
    <section className="relative z-10 mx-4 md:mx-12 my-16 animate-fade-in">
      <div className="rounded-[28px] overflow-hidden p-8 md:p-12 text-center"
        style={{ background: "linear-gradient(180deg, #5b8def 0%, #6ea1ff 60%, #8fb7ff 100%)" }}>
        <p className="text-xs md:text-sm font-bold tracking-[0.18em] text-[#d4ff3a]">HIGGSFIELD SUPERCOMPUTER</p>
        <div className="mt-6 flex justify-center gap-2 md:gap-3">
          {agents.map((c, i) => (
            <div
              key={i}
              className="size-14 md:size-16 rounded-xl border-2 border-white/40 shadow-lg flex items-center justify-center text-2xl"
              style={{ background: `radial-gradient(circle at 30% 30%, ${c}, #1a1a2e)` }}
            >
              <span className="text-white drop-shadow">{["🧑‍🎤", "👩‍🚀", "🤖", "🧝", "👨‍🎨"][i]}</span>
            </div>
          ))}
        </div>
        <h2 className="mt-8 text-5xl md:text-7xl font-semibold text-white">Supercomputer</h2>
        <p className="mt-3 text-white/90 text-base">Automate workflows, run agents, skills &amp; more</p>

        <div className="mt-8 rounded-full bg-white/30 backdrop-blur-sm border border-white/40 px-6 py-4 max-w-2xl mx-auto">
          <p className="text-white font-medium">Scan competitors every Monday and run 3 ads</p>
        </div>

        <Link
          to="/workflows"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black no-underline hover:opacity-95"
        >
          <Sparkles className="size-4" /> Run it
        </Link>
      </div>
    </section>
  );
}

/* 4 ─ Perform Anywhere */
export function MotionControlSection() {
  return (
    <section className="relative z-10 mx-4 md:mx-12 my-16 rounded-[32px] overflow-hidden border border-white/10 bg-black animate-fade-in">
      <div className="grid md:grid-cols-2 gap-8 px-6 md:px-12 py-16">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#d9ff4d] font-semibold">Perform Anywhere</p>
          <h2 className="mt-4 text-4xl md:text-6xl font-bold tracking-tight text-white">
            PERFORM ON
            <span className="block">
              <span className="text-[#d9ff4d]">[</span>
              <span className="text-[#d9ff4d]">YOUR PHONE</span>
              <span className="text-[#d9ff4d]">]</span>
            </span>
            WE BUILD
            <span className="block">THE SCENE</span>
          </h2>
          <p className="mt-4 text-white/65 max-w-md">
            Generate your AI scene in Colors Studio, then record yourself performing. Aurora transfers your real movement into the generated image — no studio, no crew.
          </p>
          <Link
            to="/motion"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#d9ff4d] px-5 py-3 text-sm font-bold text-black no-underline hover:opacity-95"
          >
            Perform Anywhere <Sparkles className="size-4" />
          </Link>
        </div>

        <div className="relative flex items-center justify-center min-h-[300px]">
          {[shot1, shot3, shot5].map((s, i) => (
            <div
              key={i}
              className="absolute rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl"
              style={{
                width: 180,
                height: 240,
                transform: `rotate(${(i - 1) * 10}deg) translateX(${(i - 1) * 80}px)`,
                zIndex: i === 1 ? 10 : 5,
              }}
            >
              <img src={s} alt="" className="size-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* 5 ─ Make Videos in One Click */
export function OneClickVideoSection() {
  const steps = [
    { n: "ADD IMAGE", d: "Upload or generate an image to start your animation", icon: ImageIcon },
    { n: "CHOOSE PRESET", d: "Pick a preset to control your image movement", icon: MousePointerClick },
    { n: "GET VIDEO", d: "Click generate to create your final animated video!", icon: Film },
  ];
  return (
    <section className="relative z-10 mx-4 md:mx-12 my-16 rounded-[32px] overflow-hidden border border-white/10 bg-[#0a0a0a] animate-fade-in">
      <div className="px-6 md:px-12 py-16">
        <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
          MAKE VIDEOS IN ONE
          <span className="block">CLICK</span>
        </h2>
        <p className="mt-4 text-white/55 max-w-xl">
          250+ presets for camera control, framing, and high-quality VFX — or use the general preset for manual control.
        </p>

        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={s.n} className="space-y-4">
              <div className="aspect-[4/3] rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-black flex items-center justify-center relative overflow-hidden">
                <s.icon className="size-12 text-white/40" />
                <div className="absolute bottom-3 right-3 text-[13px] text-white/40">Step {i + 1}</div>
              </div>
              <div>
                <p className="text-xl font-bold text-white tracking-wide">{s.n}</p>
                <p className="mt-2 text-white/55 text-sm leading-relaxed">{s.d}</p>
              </div>
            </div>
          ))}
        </div>

        <Link
          to="/studio"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-black no-underline hover:opacity-95"
        >
          <Play className="size-4" /> Start animating
        </Link>
      </div>
    </section>
  );
}

/* 6 ─ AI Canvas */
export function AiCanvasSection() {
  return (
    <section className="relative z-10 mx-4 md:mx-12 my-16 rounded-[32px] overflow-hidden border border-white/10 animate-fade-in"
      style={{ background: "radial-gradient(circle at 50% 50%, #0f2954 0%, #08152e 70%, #050a17 100%)" }}>
      <div className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.18) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

      <div className="relative px-6 md:px-12 py-20 grid md:grid-cols-[1fr_2fr_1fr] gap-6 items-center">
        <div className="hidden md:block rounded-2xl overflow-hidden border-2 border-white/20 aspect-[3/4] -rotate-3">
          <img src={shot2} alt="" className="size-full object-cover" />
        </div>

        <div className="text-center border-2 border-cyan-300/60 rounded-2xl p-8 md:p-12 relative">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-[13px] font-bold text-white tracking-wider">30% OFF</span>
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">HIGGSFIELD CANVAS</p>
          <h2 className="mt-4 text-3xl md:text-5xl font-bold text-white">
            GENERATE STUNNING<br />MEDIA WITH AI CANVAS
          </h2>
        </div>

        <div className="hidden md:block rounded-2xl overflow-hidden border-2 border-white/20 aspect-[3/4] rotate-3">
          <img src={shot6} alt="" className="size-full object-cover" />
        </div>
      </div>

      <div className="relative px-6 md:px-12 pb-12 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-3 text-sm">
          <span className="text-white font-semibold">All Canvases</span>
          <span className="text-white/40">|</span>
          <span className="text-white/60">Templates</span>
          <span className="px-2 py-0.5 rounded bg-[#d9ff4d] text-black text-[13px] font-bold">Quick Start</span>
        </div>
        <Link
          to="/canvas"
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black no-underline hover:opacity-95"
        >
          Open Canvas <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
