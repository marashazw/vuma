"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { currencyFormat } from "@/lib/commission";
import { COUNTRIES } from "@/lib/constants";
import type { CountryCode } from "@/lib/types";
import { CreditCard, Zap, Loader2, Info } from "lucide-react";

export function CreditBalanceCard() {
  const supabase = createClient();
  const [balance, setBalance] = useState(0);
  const [country, setCountry] = useState<CountryCode>("ZA");
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(1);
  const [buying, setBuying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("country").eq("id", user.id).single();
    const { data: driverProfile } = await supabase.from("driver_profiles").select("credit_balance").eq("user_id", user.id).single();
    setCountry((profile?.country as CountryCode) || "ZA");
    setBalance(Number(driverProfile?.credit_balance) || 0);
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
    </div>
  );
}
