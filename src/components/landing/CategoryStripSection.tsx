import { Link } from "@tanstack/react-router";

export function CategoryStripSection() {
  return (
    <div className="border-y border-white/8 bg-zinc-950">
      <div className="flex items-center justify-center gap-4 py-4 px-5 overflow-x-auto">
        {[
          { label: "MUSIC VIDEO STILLS", to: "/music-video" },
          { label: "TOUR POSTERS", to: "/studio" },
          { label: "PRESS PHOTOS", to: "/studio" },
        ].map((item, i, arr) => (
          <div key={item.label} className="flex items-center gap-4 shrink-0">
            <Link
              to={item.to}
              className="text-[10px] font-bold tracking-[0.22em] text-zinc-500 hover:text-zinc-200 transition-colors uppercase no-underline"
            >
              {item.label}
            </Link>
            {i < arr.length - 1 && (
              <span className="text-[#8b5cf6] text-sm font-bold">+</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
