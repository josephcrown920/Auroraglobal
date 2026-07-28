import { useEffect } from "react";
import { useGetMe, useGetCreditTransactions, getGetMeQueryKey, getGetCreditTransactionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { CreditCard, History, User, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  topup:      { label: "Top-up",    color: "text-[#34C759] bg-[#34C759]/10" },
  deduction:  { label: "Deduction", color: "text-white bg-[#333333]" },
  refund:     { label: "Refund",    color: "text-[#f6d365] bg-[#f6d365]/10" },
  bonus:      { label: "Bonus",     color: "text-[#007AFF] bg-[#007AFF]/10" },
};

export default function SettingsPage() {
  const { data: user, refetch: refetchMe } = useGetMe();
  const { data: transactions, refetch: refetchTx } = useGetCreditTransactions({ limit: 50 });
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Detect Paystack redirect with ?payment=success and refresh data
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      // Invalidate and refetch credit data
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetCreditTransactionsQueryKey() });
      refetchMe();
      refetchTx();

      // Show success toast
      toast.success("Payment successful! Your credits have been added.", {
        icon: <CheckCircle className="text-[#34C759]" size={18} />,
        duration: 6000,
      });

      // Clean the URL without triggering a navigation
      const clean = window.location.pathname;
      window.history.replaceState({}, "", clean);
    }
  }, [queryClient, refetchMe, refetchTx, setLocation]);

  return (
    <div className="max-w-4xl space-y-12 pb-12">
      <header>
        <h1 className="text-4xl font-display font-semibold text-white">Account Settings</h1>
        <p className="text-[#999999] mt-2">Manage your profile, billing, and view credit history.</p>
      </header>

      <div className="grid md:grid-cols-[1fr_2fr] gap-8">
        <div className="space-y-6">
          {/* Profile */}
          <div className="aurora-card p-6">
            <div className="flex items-center gap-3 mb-6 border-b border-[#333333] pb-4">
              <User className="text-brand" size={20} />
              <h2 className="text-lg font-display font-semibold text-white">Profile</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666] block mb-1">Email</label>
                <div className="text-sm font-medium text-white">{user?.email || "Loading..."}</div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666] block mb-1">Account ID</label>
                <div className="text-xs font-mono text-[#999999]">{user?.id || "Loading..."}</div>
              </div>
            </div>
          </div>

          {/* Credits balance */}
          <div className="aurora-card p-6 bg-gradient-to-br from-[#2A2A2A] to-[#1A1A1A]">
            <div className="flex items-center gap-3 mb-6 border-b border-[#333333] pb-4">
              <CreditCard className="text-[#f6d365]" size={20} />
              <h2 className="text-lg font-display font-semibold text-white">Credits</h2>
            </div>
            <div>
              <div className="text-4xl font-bold font-sans text-white mb-1">
                {user?.credits !== undefined ? user.credits.toLocaleString() : "—"}
              </div>
              <p className="text-sm text-[#999999] mb-6">Aura Available</p>

              <Link
                href="/pricing"
                className="aurora-btn-primary w-full block text-center text-sm font-bold uppercase tracking-wider"
              >
                Add Credits
              </Link>
            </div>
          </div>
        </div>

        {/* Transaction history */}
        <div className="aurora-card p-0 overflow-hidden">
          <div className="p-6 border-b border-[#333333] flex items-center gap-3">
            <History className="text-white" size={20} />
            <h2 className="text-lg font-display font-semibold text-white">Transaction History</h2>
          </div>

          {/* Table header */}
          {transactions?.transactions && transactions.transactions.length > 0 && (
            <div className="px-4 py-2 bg-[#1A1A1A] grid grid-cols-[1fr_auto_auto] gap-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#555555]">
              <span>Description</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Balance</span>
            </div>
          )}

          <div className="divide-y divide-[#333333]">
            {!transactions?.transactions || transactions.transactions.length === 0 ? (
              <div className="p-8 text-center text-[#999999] text-sm">
                No transactions yet. Add credits to get started.
              </div>
            ) : (
              transactions.transactions.map((tx) => {
                const meta = TYPE_LABELS[tx.type] ?? { label: tx.type, color: "text-white bg-[#333333]" };
                return (
                  <div
                    key={tx.id}
                    className="px-4 py-3.5 grid grid-cols-[1fr_auto_auto] gap-4 items-center hover:bg-[#333333]/30 transition-colors"
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <span className="text-xs text-[#999999] mt-1 truncate">
                        {tx.description || "—"}
                      </span>
                      <span className="text-[10px] text-[#555555] mt-0.5">
                        {new Date(tx.createdAt).toLocaleString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div
                      className={`font-mono text-sm font-bold text-right ${
                        tx.amount > 0 ? "text-[#34C759]" : "text-[#FF3B30]"
                      }`}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {tx.amount.toLocaleString()}
                    </div>

                    <div className="font-mono text-sm text-right text-[#999999] min-w-[4rem]">
                      {tx.balanceAfter != null ? tx.balanceAfter.toLocaleString() : "—"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
