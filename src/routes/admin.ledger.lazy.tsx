// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- generated Supabase types lag the live schema; tracked separately
// @ts-nocheck
import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { adminSearchLedger } from "@/lib/admin.functions";
import { ArrowLeft, Coins, Download, Loader2, Search } from "lucide-react";

export const Route = createLazyFileRoute("/admin/ledger")({
  component: LedgerPage,
});

type Row = {
  id: string;
  user_id: string;
  delta: number;
  reason: string | null;
  ref_id: string | null;
  created_at: string;
  email: string | null;
  displayName: string | null;
  actorId: string | null;
  actorEmail: string | null;
};

function LedgerPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  const [userQuery, setUserQuery] = useState("");
  const [refId, setRefId] = useState("");
  const [reason, setReason] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const searchFn = useServerFn(adminSearchLedger);
  const search = useMutation({
    mutationFn: () =>
      searchFn({
        data: {
          userQuery,
          refId,
          reason,
          fromDate: fromDate ? new Date(fromDate).toISOString() : "",
          toDate: toDate ? new Date(toDate + "T23:59:59").toISOString() : "",
          limit: 500,
        },
      }),
  });

  const rows: Row[] = (search.data?.rows as Row[]) ?? [];
  const truncated = search.data?.truncated ?? false;

  const totals = useMemo(() => {
    let credits = 0, debits = 0;
    for (const r of rows) {
      if (r.delta >= 0) credits += r.delta;
      else debits += r.delta;
    }
    return { credits, debits, net: credits + debits };
  }, [rows]);

  const exportCsv = () => {
    if (!rows.length) return;
    const header = ["created_at", "user_email", "display_name", "user_id", "delta", "reason", "ref_id", "actor_email", "actor_id"];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [r.created_at, r.email ?? "", r.displayName ?? "", r.user_id, r.delta, r.reason ?? "", r.ref_id ?? "", r.actorEmail ?? "", r.actorId ?? ""]
          .map(escape)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credit-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-primary">
              <Coins className="h-4 w-4" /> Admin
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Credit Ledger</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Search top-ups and debits by user, payment reference, reason, and date.
            </p>
          </div>
          <Link to="/admin" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Admin
          </Link>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            search.mutate();
          }}
          className="mb-6 grid gap-3 rounded-2xl border border-border bg-card/40 p-4 sm:grid-cols-3 lg:grid-cols-6"
        >
          <Field label="User (email, name, id)">
            <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="jane@example.com" className={inputCls} />
          </Field>
          <Field label="Payment ref">
            <input value={refId} onChange={(e) => setRefId(e.target.value)} placeholder="Paystack ref…" className={inputCls} />
          </Field>
          <Field label="Reason">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="purchase, monthly_aura…" className={inputCls} />
          </Field>
          <Field label="From">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="To">
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} />
          </Field>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={search.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
            >
              {search.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              Search
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!rows.length}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground disabled:opacity-40 hover:text-foreground"
            >
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
        </form>

        {search.error && (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {search.error instanceof Error ? search.error.message : "Search failed"}
          </div>
        )}

        {search.data && (
          <>
            <div className="mb-4 grid gap-4 sm:grid-cols-4">
              <Stat label="Rows" value={rows.length.toLocaleString() + (truncated ? "+" : "")} />
              <Stat label="Credits granted" value={"+" + totals.credits.toLocaleString()} tone="pos" />
              <Stat label="Credits debited" value={totals.debits.toLocaleString()} tone="neg" />
              <Stat label="Net" value={(totals.net >= 0 ? "+" : "") + totals.net.toLocaleString()} />
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 text-left">When</th>
                      <th className="px-4 py-3 text-left">User</th>
                      <th className="px-4 py-3 text-left">Reason</th>
                      <th className="px-4 py-3 text-left">Ref</th>
                      <th className="px-4 py-3 text-left">By</th>
                      <th className="px-4 py-3 text-right">Δ Aura</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No entries match these filters.
                        </td>
                      </tr>
                    )}
                    {rows.map((r) => (
                      <tr key={r.id} className="hover:bg-card/60">
                        <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{r.email ?? r.displayName ?? "—"}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{r.user_id}</div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.reason ?? "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.ref_id ?? "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {r.actorEmail ?? (r.actorId ? <span className="font-mono text-[11px]">{r.actorId}</span> : "—")}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right tabular-nums font-semibold ${
                            r.delta >= 0 ? "text-emerald-400" : "text-destructive"
                          }`}
                        >
                          {r.delta >= 0 ? "+" : ""}
                          {r.delta.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {truncated && (
                <p className="px-4 py-3 text-xs text-muted-foreground">
                  Showing first 500 rows. Narrow the filters for a smaller window.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  const color = tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
