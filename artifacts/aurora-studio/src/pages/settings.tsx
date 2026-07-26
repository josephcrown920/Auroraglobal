import { useGetMe, useGetCreditTransactions } from "@workspace/api-client-react";
import { Link } from "wouter";
import { CreditCard, History, User } from "lucide-react";

export default function SettingsPage() {
  const { data: user } = useGetMe();
  const { data: transactions } = useGetCreditTransactions({ limit: 10 });

  return (
    <div className="max-w-4xl space-y-12 pb-12">
      <header>
        <h1 className="text-4xl font-display font-semibold text-white">Account Settings</h1>
        <p className="text-[#999999] mt-2">Manage your profile, billing, and view credit history.</p>
      </header>

      <div className="grid md:grid-cols-[1fr_2fr] gap-8">
        <div className="space-y-6">
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

          <div className="aurora-card p-6 bg-gradient-to-br from-[#2A2A2A] to-[#1A1A1A]">
            <div className="flex items-center gap-3 mb-6 border-b border-[#333333] pb-4">
              <CreditCard className="text-[#f6d365]" size={20} />
              <h2 className="text-lg font-display font-semibold text-white">Credits</h2>
            </div>
            <div>
              <div className="text-4xl font-bold font-sans text-white mb-1">
                {user?.credits?.toLocaleString() || "0"}
              </div>
              <p className="text-sm text-[#999999] mb-6">Aura Available</p>
              
              <Link href="/pricing" className="aurora-btn-primary w-full block text-center text-sm font-bold uppercase tracking-wider">
                Add Credits
              </Link>
            </div>
          </div>
        </div>

        <div className="aurora-card p-0 overflow-hidden">
          <div className="p-6 border-b border-[#333333] flex items-center gap-3">
            <History className="text-white" size={20} />
            <h2 className="text-lg font-display font-semibold text-white">Transaction History</h2>
          </div>
          
          <div className="divide-y divide-[#333333]">
            {!transactions?.transactions || transactions.transactions.length === 0 ? (
              <div className="p-8 text-center text-[#999999] text-sm">
                No transactions found.
              </div>
            ) : (
              transactions.transactions.map((tx) => (
                <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-[#333333]/50 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white capitalize">{tx.description || tx.type}</span>
                    <span className="text-[10px] text-[#666666]">
                      {new Date(tx.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className={`font-mono text-sm font-bold ${tx.amount > 0 ? "text-[#34C759]" : "text-white"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
