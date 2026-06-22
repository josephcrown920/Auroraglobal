import { Link, useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useRef } from "react";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";

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
          <img src={auroraLogo.url} alt="Aurora" className="size-8 rounded-xl object-contain" />
          <span className="font-semibold tracking-tight">Aurora Studio</span>
        </div>
        <nav className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
          <Link to="/studio" className={`no-underline ${muted}`}>Image &amp; Video</Link>
          <Link to="/canvas" className={`no-underline ${muted}`}>Canvas</Link>
          <Link to="/ugc" className={`no-underline ${muted}`}>UGC Ads Factory</Link>
          <Link to="/canvas" className={`no-underline ${muted}`}>Motion Control</Link>
          <Link to="/lipsync" className={`no-underline ${muted}`}>Lip Sync</Link>
          <Link to="/colors" className={`no-underline ${muted}`}>Colors Studio</Link>
          <Link to="/gallery" className={`no-underline ${muted}`}>Gallery</Link>
          <Link to="/gifts" className={`no-underline ${muted}`}>Gift cards</Link>
          <Link to="/affiliate" className={`no-underline ${muted}`}>Affiliate</Link>
          <Link to="/contact" className={`no-underline ${muted}`}>Contact</Link>
          <Link to="/legal/$slug" params={{ slug: "terms" }} className={`no-underline ${muted}`}>Terms</Link>
          <Link to="/legal/$slug" params={{ slug: "privacy" }} className={`no-underline ${muted}`}>Privacy</Link>
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

