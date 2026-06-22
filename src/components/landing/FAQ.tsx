import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "How does Aurora (our credit) work?",
    a: "1 Aurora ≈ 1 image. Videos cost 5 Aurora (5s) or 10 Aurora (10s). Lip-sync is 1 Aurora per second. Aurora never expires and rolls across every model.",
  },
  {
    q: "Can I use the results commercially?",
    a: "Yes. Every paid plan includes a full commercial license for the outputs you generate — ads, music videos, UGC, client deliverables. You own the renders.",
  },
  {
    q: "Which models are included?",
    a: "All of them. Seedance 2.0, Kling 3.0, Nano Banana Pro, Seedream 4.5, Sync 1.9 lip-sync, and every new model we ship. No per-model surcharge.",
  },
  {
    q: "Do you store my photos?",
    a: "Uploads are stored privately in your account so you can re-render. You can delete any asset at any time from your dashboard, and we never train on user content.",
  },
  {
    q: "What if I'm not happy?",
    a: "7-day refund on any unused Aurora, no questions asked. Email us and we'll return your remaining balance.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — every new account gets 5 free Aurora the moment you sign in. Enough to test image generation and decide if Aurora is for you.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative z-10 px-6 md:px-12 pb-24">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-violet-300/80 mb-2">FAQ</p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Answers, before you ask.</h2>
        </div>
        <div className="space-y-2">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={f.q}
                className={`rounded-2xl border transition-all ${isOpen ? "border-violet-400/40 bg-violet-500/[0.06]" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-medium text-white">{f.q}</span>
                  <ChevronDown className={`size-4 text-white/60 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-sm text-white/70 leading-relaxed animate-fade-in">
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
