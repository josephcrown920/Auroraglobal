import React from "react";
import { Link } from "wouter";
import { Show, useClerk } from "@clerk/react";
import { Plus } from "lucide-react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white font-sans antialiased selection:bg-brand selection:text-white flex flex-col">
      <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#1A1A1A]/80 backdrop-blur-md">
        <div className="grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 sm:flex sm:justify-between">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="inline-block size-2 shrink-0 rounded-full bg-brand" />
            <span className="truncate text-[11px] sm:text-sm font-display font-bold uppercase tracking-[0.18em] text-white">
              <span className="sm:hidden">AURORA</span>
              <span className="hidden sm:inline">AURORA PERFORMANCE STUDIO</span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-3">
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-full bg-white py-2 pl-2 pr-3 text-sm font-semibold text-[#1A1A1A] transition-transform hover:scale-[1.02] active:scale-95"
              >
                <Plus className="size-4 mr-1.5 shrink-0" strokeWidth={2.5} />
                Open Studio
              </Link>
            </Show>
            <Show when="signed-out">
              <>
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-zinc-400 transition-colors hover:text-white"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center rounded-full bg-white py-2 pl-2 pr-3 text-sm font-semibold text-[#1A1A1A] transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <Plus className="size-4 mr-1.5 shrink-0" strokeWidth={2.5} />
                  Start creating
                </Link>
              </>
            </Show>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t border-white/5 px-5 pb-8 pt-14 bg-[#1A1A1A]">
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-block size-2 rounded-full bg-brand" />
          <span className="text-lg font-display font-semibold uppercase italic tracking-tighter">AURORA</span>
        </div>

        <p className="mb-10 text-sm text-[#999999]">
          The performance studio for the algorithmic age. Build your world with intent.
        </p>
        <div className="mb-10 grid grid-cols-3 gap-6">
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Product</h4>
            <Link href="/studio" className="text-sm text-[#999999] hover:text-white">Studio</Link>
            <Link href="/pricing" className="text-sm text-[#999999] hover:text-white">Pricing</Link>
          </div>
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Create</h4>
            <Link href="/motion" className="text-sm text-[#999999] hover:text-white">Motion</Link>
            <Link href="/gallery" className="text-sm text-[#999999] hover:text-white">Gallery</Link>
          </div>
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Legal</h4>
            <span className="text-sm text-[#999999]">Privacy</span>
            <span className="text-sm text-[#999999]">Terms</span>
          </div>
        </div>
        <div className="border-t border-white/5 pt-6 text-xs text-[#666666]">
          © {new Date().getFullYear()} AURORA Performance Studio. Built for the artist.
        </div>
      </footer>
    </div>
  );
}
