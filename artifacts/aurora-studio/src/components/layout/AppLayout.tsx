import React from "react";
import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { LayoutDashboard, Library, Settings, LogOut, Menu, X, Sparkles } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/gallery", label: "Gallery", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { data: user } = useGetMe({ query: { refetchOnWindowFocus: true } });

  return (
    <div className="flex h-[100dvh] bg-background text-white overflow-hidden font-sans">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-background border-b border-border z-40 flex items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-full bg-brand" />
          <span className="font-display font-bold text-sm uppercase tracking-[0.18em]">Aurora</span>
        </Link>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-muted-foreground hover:text-white">
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-60 bg-background border-r border-border flex flex-col transition-transform duration-300
        md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center px-5 border-b border-border mt-14 md:mt-0">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-brand" />
            <span className="font-display font-bold text-sm uppercase tracking-[0.18em]">Aurora</span>
          </Link>
        </div>

        <div className="p-4">
          <div className="aurora-card p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Credits</p>
              <p className="text-xl font-bold text-white flex items-center gap-1">
                <span className="text-brand text-sm">✦</span>
                {user?.credits !== undefined ? user.credits.toLocaleString() : '—'}
              </p>
            </div>
            <Link href="/settings" className="text-[10px] font-bold uppercase tracking-wider text-brand hover:underline">
              Top up
            </Link>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
          {navItems.map((item) => {
            const active = location === item.href || location.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active ? 'bg-card text-white' : 'text-muted-foreground hover:text-white hover:bg-card/50'}
                `}
              >
                <Icon size={18} className={active ? "text-brand" : "opacity-70"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <button
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut size={18} className="opacity-70" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative md:ml-60 w-full h-[100dvh] bg-background">
        <div className="flex-1 overflow-y-auto pt-14 md:pt-0 scroll-smooth px-4 md:px-10">
          <div className="max-w-[1200px] mx-auto py-8 md:py-10">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
