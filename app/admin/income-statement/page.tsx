"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { currencyFormat } from "@/lib/commission";
import { exportToCsv } from "@/lib/csv-export";
import { COUNTRIES } from "@/lib/constants";
import type { CountryCode } from "@/lib/types";
import { Loader2, Printer, Download } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, startOfYear } from "date-fns";

type Period = "this_month" | "last_month" | "this_year" | "custom";

interface CurrencyFigures {
  currency: string;
  commissionBySource: Record<string, number>;
  commissionTotal: number;
  subscriptionRevenue: number;
  totalRevenue: number;
  driverWallets: number;
  unearnedSubscriptions: number;
  riderWallets: number;
  riderCredits: number;
  totalLiabilities: number;
}

const SOURCE_LABELS: Record<string, string> = {
  country_default: "Country default rate",
  subscription: "Subscription rate",
  referral_credit: "Referral credit (0%)",
  reward_credit: "Reward credit (0%)",
  wallet_charged_at_start: "Standard rate",
};

// Country -> currency, so driver_profiles/wallet balances (which don't
// store currency directly) can be grouped correctly.
const COUNTRY_CURRENCY: Record<string, string> = { ZA: "ZAR", ZW: "USD", OTHER: "USD" };

export default function IncomeStatementPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [figures, setFigures] = useState<CurrencyFigures[]>([]);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  function periodRange(): { from: Date; to: Date; label: string } {
    const now = new Date();
    if (period === "this_month") return { from: startOfMonth(now), to: now, label: format(now, "MMMM yyyy") + " (to date)" };
    if (period === "last_month") {
      const lm = subMonths(now, 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm), label: format(lm, "MMMM yyyy") };
    }
    if (period === "this_year") return { from: startOfYear(now), to: now, label: format(now, "yyyy") + " (to date)" };
    return {
      from: customFrom ? new Date(customFrom) : startOfMonth(now),
      to: customTo ? new Date(customTo + "T23:59:59") : now,
      label: customFrom && customTo ? `${customFrom} to ${customTo}` : "Custom period",
    };
  }

  async function load() {
    setLoading(true);
    const { from, to } = periodRange();

    // --- Revenue for the period ---
    const { data: txns } = await supabase
      .from("transactions")
      .select("type, amount, commission_amount, commission_source, currency, status")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .eq("status", "success");

    const currencies = new Set<string>(["ZAR", "USD"]);
    (txns || []).forEach((t) => currencies.add(t.currency));

    const byCurrency: Record<string, CurrencyFigures> = {};
    currencies.forEach((c) => {
      byCurrency[c] = {
        currency: c,
        commissionBySource: {},
        commissionTotal: 0,
        subscriptionRevenue: 0,
        totalRevenue: 0,
        driverWallets: 0,
        unearnedSubscriptions: 0,
        riderWallets: 0,
        riderCredits: 0,
        totalLiabilities: 0,
      };
    });

    (txns || []).forEach((t) => {
      const fig = byCurrency[t.currency];
      if (!fig) return;
      if (t.type === "ride_commission" && t.commission_amount) {
        const src = t.commission_source || "unknown";
        fig.commissionBySource[src] = (fig.commissionBySource[src] || 0) + Number(t.commission_amount);
        fig.commissionTotal += Number(t.commission_amount);
      }
      if (t.type === "subscription_payment") {
        fig.subscriptionRevenue += Number(t.amount);
      }
    });

    // --- Outstanding liabilities (current snapshot, not period-bound) ---

    // Driver prepaid wallet balances, grouped by their country's currency.
    const { data: driverProfiles } = await supabase
      .from("driver_profiles")
      .select("prepaid_wallet_balance, user_id, profiles!inner(country)");
    (driverProfiles as any[] | null)?.forEach((d) => {
      const currency = COUNTRY_CURRENCY[d.profiles?.country] || "ZAR";
      if (byCurrency[currency]) byCurrency[currency].driverWallets += Number(d.prepaid_wallet_balance) || 0;
    });

    // Unearned (pro-rated) value of every currently-active subscription —
    // the portion of what was paid upfront that hasn't been "earned" yet
    // by the passage of time.
    const { data: activeSubs } = await supabase
      .from("driver_subscriptions")
      .select("amount_paid, starts_at, ends_at, plan:subscription_plans(currency)")
      .eq("status", "active")
      .gte("ends_at", new Date().toISOString());
    (activeSubs as any[] | null)?.forEach((s) => {
      const currency = s.plan?.currency || "ZAR";
      const totalMs = new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime();
      const remainingMs = new Date(s.ends_at).getTime() - Date.now();
      const fraction = totalMs > 0 ? Math.max(Math.min(remainingMs / totalMs, 1), 0) : 0;
      if (byCurrency[currency]) byCurrency[currency].unearnedSubscriptions += Number(s.amount_paid) * fraction;
    });

    // Rider wallet (change credit) balances.
    const { data: riderProfiles } = await supabase.from("profiles").select("wallet_balance, wallet_currency").eq("role", "rider");
    (riderProfiles || []).forEach((r: any) => {
      const currency = r.wallet_currency || "ZAR";
      if (byCurrency[currency]) byCurrency[currency].riderWallets += Number(r.wallet_balance) || 0;
    });

    // Available referral ride credits.
    const { data: credits } = await supabase.from("ride_credits").select("amount, currency").eq("status", "available");
    (credits || []).forEach((c) => {
      if (byCurrency[c.currency]) byCurrency[c.currency].riderCredits += Number(c.amount) || 0;
    });

    Object.values(byCurrency).forEach((fig) => {
      fig.totalRevenue = fig.commissionTotal + fig.subscriptionRevenue;
      fig.totalLiabilities = fig.driverWallets + fig.unearnedSubscriptions + fig.riderWallets + fig.riderCredits;
    });

    setFigures(Object.values(byCurrency).filter((f) => f.currency === "ZAR" || f.currency === "USD"));
    setGeneratedAt(new Date());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customFrom, customTo]);

  function handleExport() {
    const { label } = periodRange();
    const rows: Record<string, string | number>[] = [];
    figures.forEach((f) => {
      rows.push({ Section: "Period", Currency: f.currency, Line: "Period", Value: label });
      Object.entries(f.commissionBySource).forEach(([src, amt]) => {
        rows.push({ Section: "Revenue", Currency: f.currency, Line: `Commission — ${SOURCE_LABELS[src] || src}`, Value: amt.toFixed(2) });
      });
      rows.push({ Section: "Revenue", Currency: f.currency, Line: "Commission total", Value: f.commissionTotal.toFixed(2) });
      rows.push({ Section: "Revenue", Currency: f.currency, Line: "Subscription revenue", Value: f.subscriptionRevenue.toFixed(2) });
      rows.push({ Section: "Revenue", Currency: f.currency, Line: "Total revenue", Value: f.totalRevenue.toFixed(2) });
      rows.push({ Section: "Liabilities", Currency: f.currency, Line: "Driver prepaid wallets", Value: f.driverWallets.toFixed(2) });
      rows.push({ Section: "Liabilities", Currency: f.currency, Line: "Unearned subscriptions (pro-rated)", Value: f.unearnedSubscriptions.toFixed(2) });
      rows.push({ Section: "Liabilities", Currency: f.currency, Line: "Rider wallet balances", Value: f.riderWallets.toFixed(2) });
      rows.push({ Section: "Liabilities", Currency: f.currency, Line: "Rider referral credits", Value: f.riderCredits.toFixed(2) });
      rows.push({ Section: "Liabilities", Currency: f.currency, Line: "Total outstanding liabilities", Value: f.totalLiabilities.toFixed(2) });
    });
    exportToCsv(`vuma-income-statement-${format(new Date(), "yyyy-MM-dd")}`, rows);
  }

  const { label } = periodRange();

  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          nav, header, .no-print { display: none !important; }
          body { background: white !important; }
          .print-card { box-shadow: none !important; border: 1px solid #ddd !important; }
        }
      `}</style>

      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold">Income Statement</h1>
          <p className="text-navy-400 text-sm mt-1">Revenue for the selected period, and outstanding balances as of now.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost !py-2 !px-3 text-sm" onClick={handleExport} disabled={loading || !figures.length}>
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button className="btn-primary !py-2 !px-3 text-sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="card p-4 no-print">
        <div className="flex flex-wrap gap-2">
          {(["this_month", "last_month", "this_year", "custom"] as Period[]).map((p) => (
            <button
              key={p}
              className={`btn-ghost !py-1.5 !px-3 text-xs ${period === p ? "!bg-navy-800 !text-paper !border-navy-800" : ""}`}
              onClick={() => setPeriod(p)}
            >
              {p === "this_month" ? "This month" : p === "last_month" ? "Last month" : p === "this_year" ? "This year" : "Custom"}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex items-center gap-2 mt-3">
            <input type="date" className="input !py-2 text-sm" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span className="text-navy-400 text-sm">to</span>
            <input type="date" className="input !py-2 text-sm" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}
      </div>

      <div className="text-center">
        <h2 className="text-lg font-bold text-navy-800">Vuma — Income Statement</h2>
        <p className="text-sm text-navy-400">
          Revenue for {label}
          {generatedAt && ` · Generated ${format(generatedAt, "d MMM yyyy, HH:mm")}`}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-navy-300">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Calculating&hellip;
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {figures.map((f) => (
            <div key={f.currency} className="card print-card p-5 space-y-5">
              <p className="label text-center !text-base">{COUNTRIES[(Object.keys(COUNTRY_CURRENCY) as CountryCode[]).find((c) => COUNTRY_CURRENCY[c] === f.currency) || "ZA"]?.label || f.currency} ({f.currency})</p>

              <div>
                <p className="label mb-2 !text-jade-600">Revenue — {label}</p>
                <div className="space-y-1.5">
                  {Object.entries(f.commissionBySource).map(([src, amt]) => (
                    <div key={src} className="flex justify-between text-sm text-navy-500">
                      <span>Commission — {SOURCE_LABELS[src] || src}</span>
                      <span className="fare-figure">{currencyFormat(amt, f.currency)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold text-navy-700 border-t border-navy-50 pt-1.5">
                    <span>Commission total</span>
                    <span className="fare-figure">{currencyFormat(f.commissionTotal, f.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-navy-500">
                    <span>Subscription revenue</span>
                    <span className="fare-figure">{currencyFormat(f.subscriptionRevenue, f.currency)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-navy-800 border-t border-navy-100 pt-2 mt-1">
                    <span>Total revenue</span>
                    <span className="fare-figure">{currencyFormat(f.totalRevenue, f.currency)}</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="label mb-2 !text-coral-600">Outstanding liabilities (as of now)</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm text-navy-500">
                    <span>Driver prepaid wallets</span>
                    <span className="fare-figure">{currencyFormat(f.driverWallets, f.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-navy-500">
                    <span>Unearned subscriptions (pro-rated)</span>
                    <span className="fare-figure">{currencyFormat(f.unearnedSubscriptions, f.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-navy-500">
                    <span>Rider wallet balances</span>
                    <span className="fare-figure">{currencyFormat(f.riderWallets, f.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-navy-500">
                    <span>Rider referral credits</span>
                    <span className="fare-figure">{currencyFormat(f.riderCredits, f.currency)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-navy-800 border-t border-navy-100 pt-2 mt-1">
                    <span>Total outstanding</span>
                    <span className="fare-figure">{currencyFormat(f.totalLiabilities, f.currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
