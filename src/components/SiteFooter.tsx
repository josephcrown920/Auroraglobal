import { Link, useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useRef } from "react";
import { openConsentManager } from "@/lib/consent";

export function SiteFooter({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const muted = tone === "dark" ? "text-white/50 hover:text-white" : "text-muted-foreground hover:text-foreground";
  const border = tone === "dark" ? "border-white/10" : "border-border";
  const dim = tone === "dark" ? "text-white/40" : "text-muted-foreground";
  const navigate = useNavigate();
  const taps = useRef<number[]>([]);

  const onSecretTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 3000), now];
    if (taps.current.length >= 7) {
      taps.current = [];
      navigate({ to: "/admin" });
    }
  };

  return (
    <footer className={`relative z-10 border-t ${border} px-6 md:px-12 py-10 mt-12`}>
      <div className="max-w-6xl mx-auto grid gap-8 md:grid-cols-[1fr_2fr] items-start">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 shadow-[var(--shadow-glow-soft)]"><span className="inline-block size-2.5 rounded-full bg-primary" /></span>
          <span className="font-semibold tracking-tight">Aurora Studio</span>
        </div>
        <nav className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
          <Link to="/studio" className={`no-underline ${muted}`}>Image &amp; Video</Link>
          <Link to="/canvas" className={`no-underline ${muted}`}>Canvas</Link>
          <Link to="/ugc" className={`no-underline ${muted}`}>UGC Ads Factory</Link>
          <Link to="/motion" className={`no-underline ${muted}`}>Perform Anywhere</Link>
          <Link to="/lipsync" className={`no-underline ${muted}`}>Lip Sync</Link>
          <Link to="/colors" className={`no-underline ${muted}`}>Colors Studio</Link>
          <Link to="/reshoot" className={`no-underline ${muted}`}>Multi-Angle Reshoot</Link>
          <Link to="/gallery" className={`no-underline ${muted}`}>Gallery</Link>
          <Link to="/gifts" className={`no-underline ${muted}`}>Gift cards</Link>
          <Link to="/partners" className={`no-underline ${muted}`}>Partners</Link>
          <Link to="/contact" className={`no-underline ${muted}`}>Contact</Link>
          <Link to="/legal/$slug" params={{ slug: "terms" }} className={`no-underline ${muted}`}>Terms</Link>
          <Link to="/legal/$slug" params={{ slug: "privacy" }} className={`no-underline ${muted}`}>Privacy</Link>
          <Link to="/legal/$slug" params={{ slug: "ai-policy" }} className={`no-underline ${muted}`}>AI Policy</Link>
          <Link to="/legal/$slug" params={{ slug: "cookies" }} className={`no-underline ${muted}`}>Cookie Policy</Link>
          <button type="button" onClick={openConsentManager} className={`no-underline text-left ${muted}`}>Cookie Preferences</button>
        </nav>
      </div>
      <p className={`text-center text-xs mt-8 ${dim}`}>
        © {new Date().getFullYear()} Aurora Studio. AI-generated content — review before publishing.
        {/* Hidden owner entrance: tap the dot 7× within 3s */}
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={onSecretTap}
          className="ml-1 inline-block align-middle opacity-30 hover:opacity-60"
          style={{ width: 6, height: 6, borderRadius: 9999, background: "currentColor", padding: 0, border: 0 }}
        />
      </p>
    </footer>
  );
}

