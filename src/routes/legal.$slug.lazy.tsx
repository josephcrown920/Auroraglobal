import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { LEGAL, LEGAL_VERSION, COMPANY, type LegalDoc } from "@/lib/legal";
import { SiteFooter } from "@/components/SiteFooter";
import { ArrowLeft } from "lucide-react";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";

export const Route = createLazyFileRoute("/legal/$slug")({
  component: LegalPage,
});

function LegalPage() {
  const { doc } = Route.useLoaderData() as { doc: LegalDoc };
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between pl-24 pr-6 md:pl-24 md:pr-10 py-5 border-b border-border bg-card/40 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight no-underline">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <img src={auroraLogo.url} alt="Aurora" className="size-8 rounded-xl object-contain" />
          {COMPANY.product}
        </Link>
        <div className="text-xs text-muted-foreground">Version {LEGAL_VERSION}</div>
      </header>
      <article className="max-w-3xl mx-auto px-6 md:px-10 py-12 space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">{doc.title}</h1>
          <p className="text-muted-foreground">{doc.summary}</p>
          <p className="text-xs text-muted-foreground">Last updated: {LEGAL_VERSION}</p>
        </header>
        <nav className="flex flex-wrap gap-2 text-xs">
          {Object.values(LEGAL).map((d) => (
            <Link
              key={d.slug}
              to="/legal/$slug"
              params={{ slug: d.slug }}
              className={`px-3 py-1 rounded-full border no-underline ${d.slug === doc.slug ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {d.title}
            </Link>
          ))}
        </nav>
        <div className="space-y-8">
          {doc.sections.map((s) => (
            <section key={s.heading} className="space-y-2">
              <h2 className="text-lg font-semibold">{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-muted-foreground">{p}</p>
              ))}
            </section>
          ))}
        </div>
      </article>
      <SiteFooter tone="light" />
    </main>
  );
}
