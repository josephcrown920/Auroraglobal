import { useGetDashboard } from "@workspace/api-client-react";
import { Link } from "wouter";
import { ArrowRight, Image as ImageIcon, Video, Mic, RefreshCw } from "lucide-react";

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
        <p className="text-[#FF3B30] mb-4">Failed to load dashboard data.</p>
        <button onClick={() => window.location.reload()} className="aurora-btn-secondary text-sm">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-display font-semibold text-white">Dashboard</h1>
        <p className="text-[#999999] max-w-2xl">Overview of your studio usage and recent generations.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="aurora-card p-6 flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666]">Available Credits</span>
          <span className="text-3xl font-display font-bold text-white">{dashboard.credits.toLocaleString()} <span className="text-brand text-sm align-top">✦</span></span>
          <Link href="/settings" className="text-xs text-brand hover:underline mt-2">Buy more credits</Link>
        </div>
        
        <div className="aurora-card p-6 flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666]">Total Generations</span>
          <span className="text-3xl font-display font-bold text-white">{dashboard.totalGenerations.toLocaleString()}</span>
        </div>

        <div className="aurora-card p-6 flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666]">Photos Generated</span>
          <span className="text-3xl font-display font-bold text-white">{(dashboard.photoCount || 0).toLocaleString()}</span>
        </div>

        <div className="aurora-card p-6 flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666]">Videos Generated</span>
          <span className="text-3xl font-display font-bold text-white">{(dashboard.videoCount || 0).toLocaleString()}</span>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-semibold text-white">Recent Activity</h2>
          <Link href="/gallery" className="text-sm font-medium text-[#999999] hover:text-white flex items-center gap-1">
            View Gallery <ArrowRight className="size-4" />
          </Link>
        </div>

        {dashboard.recentActivity.length === 0 ? (
          <div className="aurora-card p-12 text-center border-dashed">
            <h3 className="text-lg font-display font-semibold text-white mb-2">No generations yet</h3>
            <p className="text-[#999999] text-sm mb-6 max-w-sm mx-auto">Head over to the studio to start generating cinematic performance shots and motion reels.</p>
            <Link href="/studio" className="aurora-btn-primary inline-flex">
              Open Colors Studio
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {dashboard.recentActivity.map((item) => (
              <Link key={item.id} href={`/gallery`} className="group block relative aspect-square bg-[#2A2A2A] rounded-xl overflow-hidden border border-[#333333] hover:border-[#555555] transition-all">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt={item.type} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#1A1A1A]">
                    {item.type === 'photo' ? <ImageIcon className="text-[#666666]" size={24} /> : 
                     item.type === 'lipsync' ? <Mic className="text-[#666666]" size={24} /> :
                     <Video className="text-[#666666]" size={24} />}
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
