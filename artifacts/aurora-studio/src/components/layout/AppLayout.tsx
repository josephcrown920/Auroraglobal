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
  X
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const { data: user } = useGetMe();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/studio", label: "Colors Studio", icon: ImageIcon },
    { href: "/motion", label: "Motion Studio", icon: Video },
    { href: "/lipsync", label: "Lip Sync", icon: Mic },
    { href: "/music-video", label: "Music Videos", icon: Music },
    { href: "/ugc", label: "UGC Factory", icon: Smartphone },
    { href: "/gallery", label: "My Gallery", icon: Library },
  ];

  return (
    <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden">
      {/* Cinematic noise overlay */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.03] mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48ZmlsdGVyIGlkPSJuIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjYiIG51bU9jdGF2ZXM9IjMiIHN0aXRjaFRpbGVzPSJzdGl0Y2giLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWx0ZXI9InVybCgjbikiLz48L3N2Zz4=')]" />
      
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border z-40 flex items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src="/logo.svg" alt="Aurora" className="h-8 w-auto" />
          <span className="font-serif font-bold text-lg">Aurora</span>
        </Link>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-muted-foreground hover:text-white">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out
        md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border mt-16 md:mt-0">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <img src="/logo.svg" alt="Aurora" className="h-8 w-auto group-hover:scale-105 transition-transform" />
            <span className="font-serif font-bold text-xl tracking-tight text-white">Aurora</span>
          </Link>
        </div>

        {/* User Credit Badge */}
        <div className="p-4">
          <div className="bg-card border border-border rounded-xl p-3 flex items-center justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Credits</p>
              <p className="text-lg font-bold font-mono text-white flex items-center gap-1">
                <span className="text-primary mt-1 text-sm">✦</span> 
                {user?.credits !== undefined ? user.credits.toLocaleString() : '...'}
              </p>
            </div>
            <Link href="/settings" className="bg-sidebar p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-border transition-colors">
              <CreditCard size={16} />
            </Link>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const active = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${active 
                    ? 'bg-primary/10 text-primary hover:bg-primary/20' 
                    : 'text-muted-foreground hover:text-white hover:bg-sidebar-accent'
                  }
                `}
              >
                <item.icon size={18} className={active ? "text-primary" : "opacity-70"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-1">
          <Link 
            href="/settings"
            onClick={() => setMobileMenuOpen(false)}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
              ${location === '/settings' 
                ? 'bg-primary/10 text-primary' 
                : 'text-muted-foreground hover:text-white hover:bg-sidebar-accent'
              }
            `}
          >
            <Settings size={18} className="opacity-70" />
            Settings
          </Link>
          <button 
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut size={18} className="opacity-70" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative md:ml-64 w-full h-[100dvh]">
        <div className="flex-1 overflow-y-auto pt-16 md:pt-0 scroll-smooth">
          {children}
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
