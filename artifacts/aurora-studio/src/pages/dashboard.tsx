import React from "react";
import { Link } from "wouter";
import { useGetDashboard } from "@workspace/api-client-react";
import { Loader2, Plus, Sparkles, Image as ImageIcon, Video, Mic, Music, Smartphone, ArrowRight } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export default function DashboardPage() {
  const { data: dashboard, isLoading } = useGetDashboard();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  const CHART_COLORS = ['hsl(262, 83%, 58%)', 'hsl(292, 91%, 73%)', 'hsl(35, 100%, 55%)', 'hsl(180, 80%, 50%)', 'hsl(320, 80%, 60%)'];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-white tracking-tight">Studio Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back. Here's your creative overview.</p>
        </div>
        <Link 
          href="/pricing" 
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg font-medium hover:bg-primary/20 transition-colors border border-primary/20"
        >
          <Plus size={18} /> Top Up Credits
        </Link>
      </header>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Credits Card */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0a0a0f] border border-primary/30 p-6 shadow-[0_0_30px_rgba(124,58,237,0.1)] group">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/20 blur-3xl rounded-full pointer-events-none group-hover:bg-primary/30 transition-colors duration-500" />
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Available Credits</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold font-mono text-white tracking-tight">{dashboard?.credits.toLocaleString()}</span>
            <Sparkles className="text-primary mb-1" size={20} />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Used {dashboard?.creditsUsedThisMonth || 0} credits this month.
          </p>
        </div>

        {/* Total Generations */}
        <div className="rounded-2xl bg-card border border-border p-6 flex flex-col justify-center">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Total Generations</h3>
          <div className="text-4xl font-bold text-white tracking-tight">{dashboard?.totalGenerations.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-4">
            <span className="text-emerald-500 font-medium">+{dashboard?.thisMonthGenerations || 0}</span> this month
          </p>
        </div>

        {/* Usage Breakdown */}
        <div className="rounded-2xl bg-card border border-border p-6 flex items-center gap-6">
          <div className="w-24 h-24 shrink-0 relative">
            {dashboard?.byType && dashboard.byType.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboard.byType}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={40}
                    paddingAngle={5}
                    dataKey="count"
                    stroke="none"
                  >
                    {dashboard.byType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(240, 10%, 7%)', borderColor: 'hsl(240, 10%, 12%)', borderRadius: '8px' }}
                    itemStyle={{ color: 'white' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full rounded-full border-4 border-border flex items-center justify-center">
                <span className="text-xs text-muted-foreground">No data</span>
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Breakdown</h3>
            {dashboard?.byType?.slice(0, 3).map((item, idx) => (
              <div key={item.type} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                  <span className="text-white capitalize">{item.type.replace('_', ' ')}</span>
                </div>
                <span className="font-mono text-muted-foreground">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-serif font-bold text-white mb-4">Launch Studio</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Link href="/studio" className="group p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-all text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ImageIcon className="text-primary" size={20} />
            </div>
            <span className="text-sm font-medium text-white">Colors Studio</span>
          </Link>
          <Link href="/motion" className="group p-4 rounded-xl bg-card border border-border hover:border-secondary/50 transition-all text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Video className="text-secondary" size={20} />
            </div>
            <span className="text-sm font-medium text-white">Motion Studio</span>
          </Link>
          <Link href="/lipsync" className="group p-4 rounded-xl bg-card border border-border hover:border-accent/50 transition-all text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Mic className="text-accent" size={20} />
            </div>
            <span className="text-sm font-medium text-white">Lip Sync</span>
          </Link>
          <Link href="/music-video" className="group p-4 rounded-xl bg-card border border-border hover:border-cyan-500/50 transition-all text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Music className="text-cyan-500" size={20} />
            </div>
            <span className="text-sm font-medium text-white">Music Video</span>
          </Link>
          <Link href="/ugc" className="group p-4 rounded-xl bg-card border border-border hover:border-pink-500/50 transition-all text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-pink-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Smartphone className="text-pink-500" size={20} />
            </div>
            <span className="text-sm font-medium text-white">UGC Factory</span>
          </Link>
        </div>
      </div>

      {/* Recent Generations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-serif font-bold text-white">Recent Work</h2>
          <Link href="/gallery" className="text-sm font-medium text-muted-foreground hover:text-white flex items-center gap-1 transition-colors">
            View All <ArrowRight size={16} />
          </Link>
        </div>
        
        {dashboard?.recentActivity && dashboard.recentActivity.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {dashboard.recentActivity.map((item, i) => (
              <div 
                key={item.id} 
                className="group relative aspect-square rounded-xl bg-muted border border-border overflow-hidden cursor-pointer"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {item.thumbnailUrl || item.outputUrl ? (
                  <img 
                    src={(item.thumbnailUrl || item.outputUrl) as string} 
                    alt={item.prompt || 'Generated content'} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-background/50">
                    <Loader2 className="animate-spin text-muted-foreground" size={24} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                  <span className="text-[10px] font-medium text-white uppercase tracking-widest">{item.type}</span>
                </div>
                {/* Status badge if processing */}
                {item.status === 'processing' && (
                  <div className="absolute top-2 right-2 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-white mb-2">No generations yet</h3>
            <p className="text-sm text-muted-foreground mb-6">Your studio is empty. Start creating to fill it up.</p>
            <Link href="/studio" className="inline-flex px-6 py-3 bg-primary text-white rounded-full font-medium hover:bg-primary/90 transition-colors">
              Create First Photo
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
