import { Twitter, Instagram, Copy, Share2, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Platform = "twitter" | "instagram" | "tiktok" | "copy" | "native";

type Props = {
  url: string;
  caption?: string;
  hashtags?: string[];
  className?: string;
  compact?: boolean;
  /** Which buttons to show. Defaults to all. */
  platforms?: Platform[];
};

const TIKTOK_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.77a8.18 8.18 0 0 0 4.78 1.52V6.84a4.85 4.85 0 0 1-1.01-.15Z" />
  </svg>
);

function buildShareUrl(platform: Platform, url: string, caption: string, hashtags: string[]) {
  const tags = hashtags.map((h) => `#${h}`).join(" ");
  const text = [caption, tags].filter(Boolean).join(" ");
  switch (platform) {
    case "twitter":
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    case "tiktok":
      return `https://www.tiktok.com/upload?url=${encodeURIComponent(url)}`;
    default:
      return null;
  }
}

export function ShareButtons({ url, caption = "", hashtags = [], className, compact, platforms }: Props) {
  const [copied, setCopied] = useState(false);

  const show = (p: Platform) => !platforms || platforms.includes(p);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) { handleCopy(); return; }
    try {
      await navigator.share({ title: "Aurora creation", text: caption, url });
    } catch {
      // user cancelled or unavailable
    }
  };

  const buttons: Array<{ platform: Platform; icon: React.ReactNode; label: string; onClick?: () => void }> = [
    ...(show("twitter") ? [{
      platform: "twitter" as const,
      icon: <Twitter className="size-4" />,
      label: "X / Twitter",
      onClick: () => window.open(buildShareUrl("twitter", url, caption, hashtags) ?? url, "_blank", "noopener,width=560,height=420"),
    }] : []),
    ...(show("tiktok") ? [{
      platform: "tiktok" as const,
      icon: TIKTOK_ICON,
      label: "TikTok",
      onClick: () => window.open(buildShareUrl("tiktok", url, caption, hashtags) ?? url, "_blank", "noopener"),
    }] : []),
    ...(show("instagram") ? [{
      platform: "instagram" as const,
      icon: <Instagram className="size-4" />,
      label: "Instagram",
      onClick: handleCopy,
    }] : []),
    ...(show("copy") ? [{
      platform: "copy" as const,
      icon: copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />,
      label: copied ? "Copied!" : "Copy link",
      onClick: handleCopy,
    }] : []),
    ...(show("native") && typeof navigator !== "undefined" && "share" in navigator ? [{
      platform: "native" as const,
      icon: <Share2 className="size-4" />,
      label: "Share",
      onClick: handleNativeShare,
    }] : []),
  ];

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        {buttons.map((btn) => (
          <button
            key={btn.platform}
            onClick={btn.onClick}
            title={btn.label}
            className="p-2 rounded-xl border border-border bg-transparent hover:bg-white/8 text-muted-foreground hover:text-foreground transition-all"
          >
            {btn.icon}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {buttons.map((btn) => (
        <button
          key={btn.platform}
          onClick={btn.onClick}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-transparent hover:bg-white/8 text-muted-foreground hover:text-foreground px-3 py-2 text-sm transition-all"
        >
          {btn.icon}
          <span>{btn.label}</span>
        </button>
      ))}
    </div>
  );
}
