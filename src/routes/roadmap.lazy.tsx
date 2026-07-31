import { PARTNER_COMMISSION_PCT } from "@/lib/partners";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles, Film, Palette, Wand2, Mic, Workflow, Clapperboard, Bot,
  LayoutDashboard, Images, CreditCard, Map,
  Megaphone, Flame, Factory, BookOpen, SplitSquareHorizontal, Music2,
  Scissors, LayoutTemplate, Terminal, Gift, Users, TrendingUp,
  CheckCircle2, Clock, Rocket, ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createLazyFileRoute("/roadmap")({ component: RoadmapPage });

type RoadmapItem = {
  label: string;
  description: string;
  icon: LucideIcon;
  to?: string;
  status: "live" | "building" | "planned";
  badge?: string;
};

const ITEMS: RoadmapItem[] = [
  // ── Live ──────────────────────────────────────────────────────────────
  {
    label: "Image Generation",
    description: "Identity-locked photorealistic stills from any reference photo.",
    icon: Sparkles,
    to: "/studio",
    status: "live",
  },
  {
    label: "Video Studio",
    description: "Generate video, images, audio and run the AI director agent — all in one page.",
    icon: Film,
    to: "/studio",
    status: "live",
  },
  {
    label: "Colors Studio",
    description: "12 signature color cycloramas with fixed per-color studio sets.",
    icon: Palette,
    to: "/colors",
    status: "live",
  },
  {
    label: "Motion",
    description: "Pose-to-animate, motion transfer, and performance reskin.",
    icon: Wand2,
    to: "/motion",
    status: "live",
  },
  {
    label: "Lip Sync",
    description: "Sync any video or image to an audio track with high fidelity.",
    icon: Mic,
    to: "/lipsync",
    status: "live",
  },
  {
    label: "Canvas",
    description: "Node-based visual editor for compositing and scene building.",
    icon: Workflow,
    to: "/canvas",
    status: "live",
  },
  {
    label: "Lyric Video",
    description: "Animated lyric videos synced to your track, rendered at 9:16.",
    icon: Clapperboard,
    to: "/music-video",
    status: "live",
  },
  {
    label: "Claude MCP",
    description: "Connect Claude Desktop or any MCP client to Aurora's generation API.",
    icon: Bot,
    to: "/studio",
    status: "live",
  },
  {
    label: "Dashboard",
    description: "Aura balance, recent generations, and account settings.",
    icon: LayoutDashboard,
    to: "/dashboard",
    status: "live",
  },
  {
    label: "Gallery",
    description: "Browse and download all your generated images and videos.",
    icon: Images,
    to: "/gallery",
    status: "live",
  },
  {
    label: "Plan & Billing",
    description: "Subscription management, Aura top-ups, and usage history.",
    icon: CreditCard,
    to: "/billing",
    status: "live",
  },

  // ── Building ───────────────────────────────────────────────────────────
  {
    label: "Colors → Full Performance Video",
    description: "One-step flow: upload reference photo + song → lipsync'd performance video in your chosen color stage.",
    icon: Palette,
    status: "building",
    badge: "In Progress",
  },
  {
    label: "UGC Ads",
    description: "AI-generated user-generated-content-style video ads at scale.",
    icon: Megaphone,
    to: "/ugc",
    status: "building",
    badge: "Beta",
  },
  {
    label: "Spin · 50 Posts",
    description: "Matrix-driven bulk campaign engine. Upload one photo, get 50 unique performance posts.",
    icon: Flame,
    to: "/spin",
    status: "building",
    badge: "Beta",
  },
  {
    label: "Preview-First Billing",
    description: "Every video render shows a 480p preview at half cost before charging for the full render.",
    icon: Film,
    status: "building",
    badge: "In Progress",
  },

  // ── Planned ────────────────────────────────────────────────────────────
  {
    label: "Content Machine",
    description: "Automated content calendar — drop in your branding and let Aurora handle weekly posts.",
    icon: Factory,
    to: "/content-machine",
    status: "planned",
  },
  {
    label: "Kids Stories",
    description: "Illustrated, narrated short-form stories with consistent AI characters.",
    icon: BookOpen,
    to: "/kids",
    status: "planned",
  },
  {
    label: "TikTok Studio",
    description: "Trending audio detection + auto-matched visual styles for TikTok.",
    icon: Music2,
    to: "/tiktok",
    status: "planned",
  },
  {
    label: "Clips",
    description: "Smart clip extraction from long-form video using AI scene detection.",
    icon: Scissors,
    to: "/clips",
    status: "planned",
  },
  {
    label: "AutoCut",
    description: "One-click jump-cut, color grade, and subtitle burn for talking-head content.",
    icon: Wand2,
    to: "/edit",
    status: "planned",
  },
  {
    label: "Workflows",
    description: "Visual pipeline builder — chain generation steps into repeatable automations.",
    icon: LayoutTemplate,
    to: "/workflows",
    status: "planned",
  },
  {
    label: "CLI",
    description: "Run Aurora from your terminal. Script batch generations and integrate with CI.",
    icon: Terminal,
    to: "/cli",
    status: "planned",
  },
  {
    label: "Aurora Partners",
    description: `Earn ${PARTNER_COMMISSION_PCT}% recurring commission plus free Aura for every creator you refer.`,
    icon: Users,
    to: "/partners",
    status: "live",
  },
  {
    label: "Gifts",
    description: "Send Aura credits to collaborators or fans.",
    icon: Gift,
    to: "/gifts",
    status: "planned",
  },
  {
    label: "NexusARB",
    description: "Simulated trading & financial scenario visualisation toolkit.",
    icon: TrendingUp,
    to: "/nexusarb",
    status: "planned",
  },
];

const SECTIONS: {
  key: RoadmapItem["status"];
  label: string;
  sublabel: string;
  icon: LucideIcon;
  accent: string;
  bg: string;
  ring: string;
}[] = [
  {
    key: "live",
    label: "Live Now",
    sublabel: "Ship it",
    icon: CheckCircle2,
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
  },
  {
    key: "building",
    label: "Building",
    sublabel: "In progress",
    icon: Clock,
    accent: "text-primary",
    bg: "bg-primary/10",
    ring: "ring-primary/20",
  },
  {
    key: "planned",
    label: "Planned",
    sublabel: "On the runway",
    icon: Rocket,
    accent: "text-muted-foreground",
    bg: "bg-muted/40",
    ring: "ring-border",
  },
];

function RoadmapCard({ item, accent, bg, ring }: {
  item: RoadmapItem;
  accent: string;
  bg: string;
  ring: string;
}) {
  const Icon = item.icon;
  const inner = (
    <div
      className={cn(
        "group relative flex flex-col gap-3 rounded-2xl p-4 transition-all duration-200",
        "aurora-glass",
        item.to && item.status === "live" && "cursor-pointer hover:scale-[1.02] hover:shadow-[var(--shadow-elevated)]",
        item.status !== "live" && "opacity-80",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", bg, `ring-1 ${ring}`)}>
          <Icon className={cn("size-4", accent)} />
        </span>
        {item.badge && (
          <span className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            item.status === "building" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}>
            {item.badge}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground leading-snug">{item.label}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
      </div>
    </div>
  );

  if (item.to && item.status === "live") {
    return <Link to={item.to} className="no-underline">{inner}</Link>;
  }
  return inner;
}

function RoadmapPage() {
  return (
    <div className="aurora-page-shell min-h-screen pb-24">
      <span aria-hidden className="aurora-ambient opacity-40 pointer-events-none" />

      <div className="relative mx-auto max-w-2xl px-4 pt-8">
        {/* Back */}
        <Link
          to="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground no-underline hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>

        {/* Hero */}
        <div className="mb-8 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow-soft)]">
              <Map className="size-5 text-white" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Roadmap</h1>
              <p className="text-xs text-muted-foreground">What's live, what's building, what's next</p>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="flex flex-col gap-10">
          {SECTIONS.map((section) => {
            const sectionItems = ITEMS.filter((i) => i.status === section.key);
            const Icon = section.icon;
            return (
              <section key={section.key}>
                {/* Section header */}
                <div className="mb-4 flex items-center gap-2.5">
                  <span className={cn("flex size-7 items-center justify-center rounded-xl", section.bg, `ring-1 ${section.ring}`)}>
                    <Icon className={cn("size-3.5", section.accent)} />
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-bold text-foreground">{section.label}</span>
                    <span className="text-[11px] text-muted-foreground">{section.sublabel}</span>
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {sectionItems.length} {sectionItems.length === 1 ? "item" : "items"}
                  </span>
                </div>

                {/* Cards grid */}
                <div className="grid grid-cols-1 gap-3">
                  {sectionItems.map((item) => (
                    <RoadmapCard
                      key={item.label}
                      item={item}
                      accent={section.accent}
                      bg={section.bg}
                      ring={section.ring}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-10 rounded-2xl aurora-glass p-4 text-center">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Have a feature request? Reach us at{" "}
            <a href="mailto:hello@aurorastudio.ai" className="text-primary underline underline-offset-2">
              hello@aurorastudio.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
