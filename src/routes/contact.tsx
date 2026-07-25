import { createFileRoute } from "@tanstack/react-router";
import { COMPANY } from "@/lib/legal";
import { CANONICAL_ORIGIN } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: `Contact — ${COMPANY.product}` },
      { name: "description", content: "Get in touch with the Aurora team — support, billing, abuse and press inquiries." },
      { property: "og:title", content: "Contact Aurora Studio" },
      { property: "og:description", content: "Reach Aurora for support, billing, press and abuse." },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/contact` },
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/contact` }],
  }),
});

