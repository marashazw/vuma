"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { currencyFormat } from "@/lib/commission";
import { COUNTRIES } from "@/lib/constants";
import type { CountryCode } from "@/lib/types";
import { CreditCard, Zap, Loader2, Info, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

export function CreditBalanceCard() {
  const supabase = createClient();
  const [balance, setBalance] = useState(0);
  const [country, setCountry] = useState<CountryCode>("ZA");
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(1);
  const [buying, setBuying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<{ id: string; type: string; amount: number; notes: string | null; created_at: string }[]>(
    []
  );
  const [showHistory, setShowHistory] = useState(false);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("country").eq("id", user.id).single();
    const { data: driverProfile } = await supabase.from("driver_profiles").select("credit_balance").eq("user_id", user.id).single();
    setCountry((profile?.country as CountryCode) || "ZA");
    setBalance(Number(driverProfile?.credit_balance) || 0);

    const { data: txns } = await supabase
      .from("driver_credit_transactions")
      .select("id, type, amount, notes, created_at")
      .eq("driver_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setHistory(txns || []);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cfg = COUNTRIES[country];
  const cost = cfg.priorityBoostPerDay * days;

  async function buyPriority() {
    setBuying(true);
    setNotice(null);
    const res = await fetch("/api/driver/credit/spend-priority", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    });
    const data = await res.json();
    setBuying(false);
    if (!res.ok) {
      setNotice(data.error);
      return;
    }
    setNotice(`Priority boosted by ${days} day(s)!`);
    await load();
  }

  if (loading) return null;
  if (balance <= 0) return null;

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="label flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5 text-gold-500" /> Credit balance
        </p>
        <p className="fare-figure text-xl font-bold text-gold-600">{currencyFormat(balance, cfg.currency)}</p>
      </div>

      <p className="text-xs text-navy-400 flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        Earned from honoring riders' wallet change credits. Spendable only toward your subscription or a
        priority-ranking boost — not withdrawable as cash.
      </p>

      <div className="border-t border-navy-100 pt-3 space-y-2">
        <p className="text-xs font-semibold text-navy-500">Buy priority ranking</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            className="input !py-2 w-20"
            value={days}
            onChange={(e) => setDays(Math.max(1, Number(e.target.value)))}
          />
          <span className="text-xs text-navy-400">
            day(s) &middot; {currencyFormat(cost, cfg.currency)}
          </span>
          <button className="btn-dark !py-2 ml-auto" disabled={buying || balance < cost} onClick={buyPriority}>
            {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Boost
          </button>
        </div>
        {notice && <p className="text-xs text-jade-600">{notice}</p>}
        <p className="text-[11px] text-navy-400">
          Or use this balance toward your next subscription payment on the Plan tab.
        </p>
      </div>

      <div className="border-t border-navy-100 pt-3">
        <button
          className="text-xs font-semibold text-navy-500 flex items-center gap-1"
          onClick={() => setShowHistory((v) => !v)}
        >
          {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showHistory ? "Hide" : "Show"} history
        </button>
        {showHistory && (
          <div className="mt-2 space-y-2">
            {!history.length && <p className="text-xs text-navy-400">No credit activity yet.</p>}
            {history.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <p className="text-navy-600 truncate">{t.notes || t.type.replace(/_/g, " ")}</p>
                  <p className="text-navy-400">{format(new Date(t.created_at), "d MMM yyyy, HH:mm")}</p>
                </div>
                <span className={`fare-figure shrink-0 font-semibold ${t.amount >= 0 ? "text-jade-600" : "text-coral-600"}`}>
                  {t.amount >= 0 ? "+" : ""}
                  {currencyFormat(t.amount, cfg.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
