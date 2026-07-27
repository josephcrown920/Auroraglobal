import { useGetDashboard } from "@workspace/api-client-react";
import { Link } from "wouter";
import { ArrowRight, Image as ImageIcon, Video, Mic, Music, Smartphone, RefreshCw } from "lucide-react";

const tools = [
  { href: "/studio", label: "Colors", desc: "Performance photo sets", icon: ImageIcon, cost: "2 ✦" },
  { href: "/motion", label: "Motion", desc: "Cinematic video clips", icon: Video, cost: "10 ✦" },
  { href: "/lipsync", label: "Lip Sync", desc: "Synced performance video", icon: Mic, cost: "8 ✦" },
  { href: "/music-video", label: "Music Video", desc: "Full video production", icon: Music, cost: "12 ✦" },
  { href: "/ugc", label: "TikTok30", desc: "UGC campaign batch", icon: Smartphone, cost: "6 ✦" },
];

export default function DashboardPage() {
  const { data: dashboard, isLoading, error } = useGetDashboard();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="size-6 animate-spin text-brand" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="aurora-card p-8 text-center max-w-lg mx-auto mt-12">
        <p className="text-destructive mb-4">Failed to load dashboard data.</p>
        <button onClick={() => window.location.reload()} className="aurora-btn-secondary text-sm">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">Aurora Studio</p>
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-white">What are you making today?</h1>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Available credits</p>
          <p className="text-2xl font-bold text-white flex items-center justify-end gap-1">
            <span className="text-brand">✦</span> {dashboard.credits.toLocaleString()}
          </p>
        </div>
      </header>

      {/* Tools */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="aurora-card group p-5 flex flex-col gap-4 hover:border-brand/50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-background border border-border">
                    <Icon className="size-5 text-white" />
                  </span>
                  <span className="text-xs font-bold text-brand">{tool.cost}</span>
                </div>
                <div>
                  <p className="text-lg font-display font-semibold text-white">{tool.label}</p>
                  <p className="text-sm text-muted-foreground">{tool.desc}</p>
                </div>
                <span className="mt-auto text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-white transition-colors flex items-center gap-1">
                  Create <ArrowRight className="size-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-semibold text-white">Recent activity</h2>
          <Link href="/gallery" className="text-sm font-medium text-muted-foreground hover:text-white flex items-center gap-1">
            Gallery <ArrowRight className="size-4" />
          </Link>
        </div>

        {dashboard.recentActivity.length === 0 ? (
          <div className="aurora-card p-10 text-center border-dashed border-muted-foreground/30">
            <p className="text-white font-display font-semibold mb-1">No generations yet</p>
            <p className="text-sm text-muted-foreground mb-5">Pick a tool above to start creating.</p>
            <Link href="/studio" className="aurora-btn-primary inline-flex">
              Start with Colors
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {dashboard.recentActivity.map((item) => (
              <Link key={item.id} href={`/gallery`} className="group block relative aspect-square bg-card rounded-xl overflow-hidden border border-border hover:border-muted-foreground/60 transition-all">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt={item.type} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-background">
                    {item.type === 'photo' ? <ImageIcon className="text-muted-foreground" size={24} /> : 
                     item.type === 'lipsync' ? <Mic className="text-muted-foreground" size={24} /> :
                     <Video className="text-muted-foreground" size={24} />}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                  <span className="text-xs font-medium text-white capitalize">{item.type}</span>
                  <span className="text-[10px] text-white/70">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
