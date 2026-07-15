import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { LEGAL, LEGAL_VERSION, COMPANY } from "@/lib/legal";

export const Route = createFileRoute("/legal/$slug")({
  loader: ({ params }) => {
    const doc = LEGAL[params.slug as keyof typeof LEGAL];
    if (!doc) throw notFound();
    return { doc };
  },
  head: ({ loaderData, params }) => {
    const doc = loaderData?.doc;
    return {
      meta: [
        { title: `${doc?.title ?? "Legal"} — ${COMPANY.product}` },
        { name: "description", content: doc?.summary ?? "Aurora legal documents." },
        { name: "robots", content: "index, follow" },
      ],
      links: [{ rel: "canonical", href: `https://aurorastudiostar.lovable.app/legal/${params.slug}` }],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Document not found.</p>
        <Link to="/" className="text-sm underline">Back home</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Error"}</p>
    </div>
  ),
});
