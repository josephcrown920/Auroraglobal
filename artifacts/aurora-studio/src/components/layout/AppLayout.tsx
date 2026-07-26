import React from "react";
import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { 
  LayoutDashboard, 
  Image as ImageIcon, 
  Video, 
  Mic, 
  Music, 
  Smartphone, 
  Library, 
  Settings, 
  LogOut,
  CreditCard,
  Menu,
  X,
  Palette
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const { data: user } = useGetMe();

  const artistsItems = [
    { href: "/studio", label: "Colors Performance", icon: Palette, premium: true },
    { href: "/motion", label: "Video Agent", icon: Video, premium: true },
    { href: "/lipsync", label: "Lip Sync", icon: Mic },
    { href: "/music-video", label: "Music Video", icon: Music },
  ];

  const creatorsItems = [
    { href: "/ugc", label: "TikTok30", icon: Smartphone, premium: true },
  ];

  const accountItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/gallery", label: "Gallery", icon: Library },
  ];

  return (
    <div className="flex h-[100dvh] bg-[#1A1A1A] text-white overflow-hidden font-sans">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#1A1A1A] border-b border-[#333333] z-40 flex items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="inline-block size-2 shrink-0 rounded-full bg-brand" />
          <span className="font-display font-bold text-lg uppercase tracking-[0.18em]">Aurora</span>
        </Link>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-[#999999] hover:text-white">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-[#1A1A1A] border-r border-[#333333] flex flex-col transition-transform duration-300 ease-in-out
        md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-20 flex items-center px-6 border-b border-[#333333] mt-16 md:mt-0">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <span className="inline-block size-2 shrink-0 rounded-full bg-brand" />
            <span className="font-display font-bold text-sm tracking-[0.18em] uppercase text-white">Aurora</span>
          </Link>
        </div>

        {/* User Credit Badge */}
        <div className="p-4">
          <div className="aurora-card p-3 flex items-center justify-between group">
            <div>
              <p className="text-[10px] text-[#999999] font-bold uppercase tracking-[0.2em] mb-1">Credits</p>
              <p className="text-lg font-bold font-sans text-white flex items-center gap-1">
                <span className="text-brand text-sm">✦</span> 
                {user?.credits !== undefined ? user.credits.toLocaleString() : '...'}
              </p>
            </div>
            <Link href="/settings" className="bg-[#1A1A1A] p-2 rounded-lg text-[#999999] border border-[#333333] hover:text-white hover:border-[#555555] transition-colors">
              <CreditCard size={16} />
            </Link>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-6">
          <div>
            <h4 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666]">Artists</h4>
            <div className="space-y-1">
              {artistsItems.map((item) => {
                const active = location === item.href;
                return (
                  <Link 
                    key={item.href} 
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all
                      ${active ? 'bg-[#2A2A2A] text-white' : 'text-[#999999] hover:text-white hover:bg-[#2A2A2A]/50'}
                    `}
                  >
                    <item.icon size={16} className={active ? "text-brand" : "opacity-70"} />
                    <span className={item.premium ? "aurora-gradient-text" : ""}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666]">Creators</h4>
            <div className="space-y-1">
              {creatorsItems.map((item) => {
                const active = location === item.href;
                return (
                  <Link 
                    key={item.href} 
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all
                      ${active ? 'bg-[#2A2A2A] text-white' : 'text-[#999999] hover:text-white hover:bg-[#2A2A2A]/50'}
                    `}
                  >
                    <item.icon size={16} className={active ? "text-brand" : "opacity-70"} />
                    <span className={item.premium ? "aurora-gradient-text" : ""}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666]">Account</h4>
            <div className="space-y-1">
              {accountItems.map((item) => {
                const active = location === item.href;
                return (
                  <Link 
                    key={item.href} 
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all
                      ${active ? 'bg-[#2A2A2A] text-white' : 'text-[#999999] hover:text-white hover:bg-[#2A2A2A]/50'}
                    `}
                  >
                    <item.icon size={16} className={active ? "text-brand" : "opacity-70"} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-[#333333] space-y-1">
          <Link 
            href="/settings"
            onClick={() => setMobileMenuOpen(false)}
            className={`
              flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all
              ${location === '/settings' 
                ? 'bg-[#2A2A2A] text-white' 
                : 'text-[#999999] hover:text-white hover:bg-[#2A2A2A]/50'
              }
            `}
          >
            <Settings size={16} className="opacity-70" />
            Settings
          </Link>
          <button 
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[#999999] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-all"
          >
            <LogOut size={16} className="opacity-70" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative md:ml-64 w-full h-[100dvh] bg-[#1A1A1A]">
        <div className="flex-1 overflow-y-auto pt-16 md:pt-0 scroll-smooth px-4 md:px-8">
          <div className="max-w-[1400px] mx-auto py-8">
            {children}
          </div>
        </div>
      </main>
      
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
