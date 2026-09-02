import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/crm")({
  head: () => ({
    meta: [
      { title: "CRM — Aurora Admin" },
      { name: "description", content: "Customer lifecycle, activity timeline, and product behavior." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
