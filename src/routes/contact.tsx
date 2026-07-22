import { createFileRoute } from "@tanstack/react-router";
import { COMPANY } from "@/lib/legal";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: `Contact — ${COMPANY.product}` },
      { name: "description", content: "Get in touch with the Aurora team — support, billing, abuse and press inquiries." },
      { property: "og:title", content: "Contact Aurora Studio" },
      { property: "og:description", content: "Reach Aurora for support, billing, press and abuse." },
      { property: "og:url", content: "https://auroraperformancestudio.com/contact" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/contact" }],
  }),
});

