import { Link } from "@tanstack/react-router";
import { useFeatureVisibility } from "@/components/FeatureVisibilityProvider";

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; to: string }[];
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-xs font-bold uppercase tracking-widest text-zinc-100">{title}</span>
      {links.map((l) => (
        <Link
          key={l.label}
          to={l.to}
          className="text-sm text-zinc-500 hover:text-[#8b5cf6] transition-colors"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

export function FooterSection() {
  const { showFeature } = useFeatureVisibility();

  return (
    <footer className="border-t border-white/5 pt-14 pb-8 px-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-block size-2 rounded-full bg-[#8b5cf6]" />
        <span className="text-sm font-bold tracking-[0.15em] uppercase text-zinc-100">Aurora</span>
      </div>
      <p className="text-sm text-zinc-500 mb-10">
        Built by pro artists, for artists scaling massively. The performance studio for
        the algorithmic age.
      </p>
      <div className="grid grid-cols-3 gap-6 mb-10">
        <FooterCol
          title="Product"
          links={[
            { label: "Studio", to: "/studio" },
            { label: "Canvas", to: "/canvas" },
            { label: "Video", to: "/music-video" },
            { label: "Pricing", to: "/billing" },
            { label: "Partners", to: "/partners" },
          ]}
        />
        <FooterCol
          title="Create"
          links={[
            { label: "Motion", to: "/motion" },
            { label: "Colors", to: "/colors" },
            { label: "Lip Sync", to: "/lipsync" },
            ...(showFeature("spin") ? [{ label: "TikTok30", to: "/spin" }] : []),
            { label: "Gallery", to: "/gallery" },
          ]}
        />
        <FooterCol
          title="Develop"
          links={[
            { label: "Playground", to: "/editor" },
            { label: "CLI", to: "/cli" },
            { label: "MCP", to: "/studio" },
            { label: "Privacy", to: "/" },
            { label: "Terms", to: "/" },
          ]}
        />
      </div>
      <div className="border-t border-white/5 pt-6 text-xs text-zinc-600">
        © {new Date().getFullYear()} Aurora Performance Studio. Built by pro artists, for artists who scale.
      </div>
    </footer>
  );
}
