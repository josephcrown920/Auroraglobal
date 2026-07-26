import React from "react";
import { useGetMe, useGetCreditTransactions } from "@workspace/api-client-react";
import { CreditCard, History, User as UserIcon, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export default function SettingsPage() {
  const { data: user, isLoading: userLoading } = useGetMe();
  const { data: history, isLoading: historyLoading } = useGetCreditTransactions({ limit: 20 });

  if (userLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto w-full space-y-12">
      <header>
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-white tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile, credits, and view history.</p>
      </header>

      {/* Profile Section */}
      <section>
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <UserIcon size={20} className="text-primary" /> Profile
        </h2>
        <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-6">
          <div className="h-20 w-20 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-2xl font-bold text-primary shrink-0">
            {user?.displayName ? user.displayName.charAt(0).toUpperCase() : user?.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{user?.displayName || "Creator"}</h3>
            <p className="text-muted-foreground">{user?.email}</p>
            <div className="mt-2 inline-block px-3 py-1 bg-white/5 border border-border rounded-full text-xs font-medium uppercase tracking-wider text-white">
              {user?.plan} Plan
            </div>
          </div>
        </div>
      </section>

      {/* Credits Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CreditCard size={20} className="text-secondary" /> Billing & Credits
          </h2>
          <Link href="/pricing" className="text-sm font-medium bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
            Buy Credits
          </Link>
        </div>
        
        <div className="bg-gradient-to-br from-[#111116] to-[#0a0a0f] border border-primary/20 rounded-2xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
          
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Current Balance</p>
          <div className="text-5xl font-mono font-bold text-white mb-4">
            {user?.credits.toLocaleString()} <span className="text-xl text-muted-foreground">Credits</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            Credits are used to generate content in the studio. They never expire. If you run out, you can top up anytime.
          </p>
        </div>
      </section>

      {/* Transaction History */}
      <section>
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <History size={20} className="text-accent" /> Transaction History
        </h2>
        
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {historyLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="animate-spin text-muted-foreground" size={24} />
            </div>
          ) : history?.transactions && history.transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Description</th>
                    <th className="px-6 py-4 font-medium text-right">Amount</th>
                    <th className="px-6 py-4 font-medium text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {format(new Date(tx.createdAt), 'MMM d, yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 text-white">
                        {tx.description}
                        {tx.reference && <span className="text-xs text-muted-foreground ml-2 block sm:inline">Ref: {tx.reference}</span>}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap font-mono">
                        <span className={`inline-flex items-center gap-1 ${tx.type === 'deduction' ? 'text-red-400' : 'text-emerald-400'}`}>
                          {tx.type === 'deduction' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                          {tx.type === 'deduction' ? '-' : '+'}{tx.amount}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-muted-foreground font-mono">
                        {tx.balanceAfter}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              No transactions found.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
