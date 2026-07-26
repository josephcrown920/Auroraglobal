import React from "react";
import { Link } from "wouter";
import { Show, useClerk } from "@clerk/react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative overflow-hidden text-foreground">
      {/* Cinematic noise overlay */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.03] mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48ZmlsdGVyIGlkPSJuIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjYiIG51bU9jdGF2ZXM9IjMiIHN0aXRjaFRpbGVzPSJzdGl0Y2giLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWx0ZXI9InVybCgjbikiLz48L3N2Zz4=')]" />
      
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <img src="/logo.svg" alt="Aurora Logo" className="h-8 w-auto group-hover:scale-105 transition-transform duration-300" />
            <span className="font-serif font-bold text-xl tracking-tight text-white">Aurora</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Features</Link>
            <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Pricing</Link>
          </nav>
          
          <div className="flex items-center gap-4">
            <Show when="signed-out">
              <Link href="/sign-in" className="text-sm font-medium text-white hover:text-primary transition-colors">Log In</Link>
              <Link href="/sign-up" className="text-sm font-medium bg-primary text-white px-4 py-2 rounded-full hover:bg-primary/90 hover:shadow-[0_0_15px_rgba(124,58,237,0.4)] transition-all">Get Started</Link>
            </Show>
            <Show when="signed-in">
              <Link href="/dashboard" className="text-sm font-medium text-white hover:text-primary transition-colors">Go to Studio</Link>
              <button onClick={() => signOut({ redirectUrl: basePath || "/" })} className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Sign Out</button>
            </Show>
          </div>
        </div>
      </header>
      
      <main className="flex-1">
        {children}
      </main>
      
      <footer className="border-t border-border py-12 mt-20 bg-card">
        <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <img src="/logo.svg" alt="Aurora Logo" className="h-6 w-auto opacity-80" />
              <span className="font-serif font-bold tracking-tight text-white/80">Aurora</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-sm">
              The AI creative studio for artists, performers, and creators. Cinematic visuals from a single selfie.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="/sign-in" className="hover:text-white transition-colors">Studio Access</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-6 mt-12 pt-8 border-t border-border flex justify-between items-center">
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} Aurora Performance Studio. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
