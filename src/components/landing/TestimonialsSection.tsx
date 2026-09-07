import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function TestimonialsSection() {
  return (
    <section className="border-y border-white/5 px-5 py-12">
      <div className="mb-7">
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">
          30-day transformation
        </span>
        <h2 className="mt-2 text-3xl font-semibold leading-tight">
          Make the next release feel{" "}
          <span className="bg-gradient-to-r from-violet-200 via-violet-400 to-fuchsia-300 bg-clip-text font-sans font-semibold text-transparent">impossible to ignore.</span>
        </h2>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { quote: "“I can test three visual directions before I book a single shoot. That changes every release meeting.”", role: "Independent artist · Visual rollout" },
          { quote: "“The moodboard finally became a real world I could send to my team — not another folder of references.”", role: "Creative director · Music & culture" },
          { quote: "“I made a week of release assets in one night, then spent the rest of it making the music better.”", role: "Recording artist · Campaign launch" },
        ].map((testimonial) => (
          <figure key={testimonial.role} className="rounded-2xl border border-white/8 bg-zinc-900/70 p-5">
            <div className="mb-4 flex items-center gap-1 text-[#8b5cf6]" aria-label="Five star review">★★★★★</div>
            <blockquote className="font-serif text-base leading-snug text-zinc-100">{testimonial.quote}</blockquote>
            <figcaption className="mt-5 border-t border-white/8 pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">{testimonial.role}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
