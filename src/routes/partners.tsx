import { createFileRoute } from "@tanstack/react-router";
import { PARTNER_COMMISSION_PCT, REFERRAL_AURA_EACH } from "@/lib/partners";

export const Route = createFileRoute("/partners")({
  head: () => ({
    meta: [
      { title: "Aurora Partners — earn with every creator you refer" },
      { name: "description", content: `Earn ${PARTNER_COMMISSION_PCT}% recurring commission on every Aura purchase you refer, plus +${REFERRAL_AURA_EACH} Aura for you and every friend who joins. Apply in under 60 seconds.` },
      { property: "og:title", content: `Aurora Partners — ${PARTNER_COMMISSION_PCT}% recurring` },
      { property: "og:description", content: `Refer creators, earn ${PARTNER_COMMISSION_PCT}% recurring commission and free Aura. Featured on Aurora, early access to new features.` },
      { property: "og:url", content: "https://auroraperformancestudio.com/partners" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/partners" }],
  }),
});
