"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { currencyFormat } from "@/lib/commission";
import type { WalletTransaction } from "@/lib/types";
import { Loader2, Wallet, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { format } from "date-fns";

const TYPE_LABELS: Record<string, string> = {
  change_credit: "Change credited by driver",
  reserved: "Applied to a ride",
  redeemed: "Applied to a ride",
  refunded: "Refunded (ride cancelled)",
  admin_adjustment: "Adjustment by admin",
};

export default function WalletPage() {
  const supabase = createClient();
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState("ZAR");
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("wallet_balance, wallet_currency, country")
        .eq("id", user.id)
        .single();
      setBalance(Number(profile?.wallet_balance) || 0);
      setCurrency(profile?.wallet_currency || (profile?.country === "ZW" ? "USD" : "ZAR"));

      const { data: txns } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("rider_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setTransactions((txns as WalletTransaction[]) || []);

      setLoading(false);
    })();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="text-navy-400 text-sm mt-1">
          If a driver doesn't have change, they can credit your wallet instead — apply it to any future ride.
        </p>
      </div>

      <div className="card p-6 bg-navy-800 text-paper text-center">
        <p className="text-navy-300 text-xs uppercase tracking-wide font-semibold flex items-center justify-center gap-1.5 mb-2">
          <Wallet className="w-3.5 h-3.5" /> Balance
        </p>
        <p className="fare-figure text-3xl font-bold text-gold-400">{currencyFormat(balance, currency)}</p>
      </div>

      <div>
        <p className="label mb-3">History</p>
        {!transactions.length && <p className="text-navy-400 text-sm">No wallet activity yet.</p>}
        <ul className="space-y-2">
          {transactions
            .filter((t) => t.amount !== 0)
            .map((t) => (
              <li key={t.id} className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {t.amount > 0 ? (
                    <ArrowDownLeft className="w-4 h-4 text-jade-500" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-coral-500" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{TYPE_LABELS[t.type] || t.type}</p>
                    <p className="text-xs text-navy-400">{format(new Date(t.created_at), "d MMM yyyy, HH:mm")}</p>
                  </div>
                </div>
                <p className={`fare-figure font-semibold ${t.amount > 0 ? "text-jade-600" : "text-coral-600"}`}>
                  {t.amount > 0 ? "+" : ""}
                  {currencyFormat(t.amount, t.currency)}
                </p>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
