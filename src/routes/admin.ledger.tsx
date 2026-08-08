import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/ledger")({
  head: () => ({
    meta: [
      { title: "Credit Ledger — Aurora Admin" },
      { name: "description", content: "Search and export the credit ledger by user, payment reference, and date." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
