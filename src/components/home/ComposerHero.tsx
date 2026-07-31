import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Camera, ArrowUp } from "lucide-react";

export function ComposerHero() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (q) {
      void navigate({ to: "/studio", search: { q } });
    } else {
      void navigate({ to: "/studio" });
    }
  };

  return (
    <section className="flex flex-col items-center px-5 pt-8 pb-7 text-center">
      {/* Headline */}
      <h1
        className="mb-1.5 text-[1.75rem] font-semibold leading-[1.18] tracking-tight text-foreground"
        style={{ textShadow: "0 2px 24px oklch(0.58 0.22 25 / 0.15)" }}
      >
        What are we creating
        <br />
        <span
          className="font-serif italic"
          style={{ color: "var(--primary-glow)" }}
        >
          today?
        </span>
      </h1>
      <p className="mb-6 text-[13px] leading-snug text-muted-foreground/60">
        Describe your vision and let Aurora bring it to life.
      </p>

      {/* Composer box */}
      <form onSubmit={handleSubmit} className="relative w-full">
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: "oklch(0.11 0.015 272)",
            border: "1px solid oklch(1 0 0 / 0.09)",
            boxShadow: "0 8px 40px -10px oklch(0.58 0.22 25 / 0.20), 0 2px 0 oklch(1 0 0 / 0.04) inset",
          }}
        >
          {/* Top gradient line */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent 10%, oklch(0.58 0.22 25 / 0.35) 50%, transparent 90%)",
            }}
          />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              // auto-grow
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
            }}
            placeholder="A moody R&B music video, neon city streets, rain falling on glass…"
            rows={3}
            className="w-full resize-none bg-transparent px-4 pt-4 pb-14 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/35 focus:outline-none"
            style={{ minHeight: 106 }}
          />

          {/* Bottom toolbar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-3 pt-1">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground/45 transition-colors hover:bg-white/[0.06] hover:text-muted-foreground/70"
            >
              <Camera className="size-3.5" />
              Attach reference
            </button>

            <button
              type="submit"
              aria-label="Create"
              className="flex size-8 items-center justify-center rounded-xl transition-all hover:scale-105 active:scale-95"
              style={{
                background: "oklch(0.58 0.22 25)",
                boxShadow: "0 4px 18px -4px oklch(0.58 0.22 25 / 0.65)",
              }}
            >
              <ArrowUp className="size-[17px] text-white" />
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
