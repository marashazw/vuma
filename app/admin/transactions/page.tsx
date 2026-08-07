"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatusPill } from "@/components/ui/StatusPill";
import { currencyFormat } from "@/lib/commission";
import { exportToCsv } from "@/lib/csv-export";
import type { Transaction, Profile } from "@/lib/types";
import { Loader2, Download, FileBarChart } from "lucide-react";
import { format, subDays, startOfMonth, startOfToday } from "date-fns";
import Link from "next/link";

const TYPE_LABELS: Record<string, string> = {
  ride_commission: "Ride commission",
  subscription_payment: "Subscription payment",
  payout: "Payout",
  refund: "Refund",
};

const SOURCE_LABELS: Record<string, string> = {
  country_default: "Country default rate",
  subscription: "Subscription rate",
  referral_credit: "Referral credit (0%)",
  reward_credit: "Reward credit (0%)",
  wallet_charged_at_start: "Charged at trip-start",
};

type DatePreset = "7d" | "30d" | "month" | "all" | "custom";

export default function AdminTransactionsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<(Transaction & { driverName?: string; riderName?: string })[]>([]);
  const [drivers, setDrivers] = useState<Profile[]>([]);

  const [preset, setPreset] = useState<DatePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [driverFilter, setDriverFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  function dateRange(): { from: Date | null; to: Date | null } {
    const now = new Date();
    if (preset === "7d") return { from: subDays(now, 7), to: now };
    if (preset === "30d") return { from: subDays(now, 30), to: now };
    if (preset === "month") return { from: startOfMonth(now), to: now };
    if (preset === "all") return { from: null, to: null };
    return {
      from: customFrom ? new Date(customFrom) : null,
      to: customTo ? new Date(customTo + "T23:59:59") : null,
    };
  }

  async function load() {
    setLoading(true);
    const { from, to } = dateRange();

    let query = supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500);
    if (from) query = query.gte("created_at", from.toISOString());
    if (to) query = query.lte("created_at", to.toISOString());
    if (driverFilter !== "all") query = query.eq("driver_id", driverFilter);
    if (typeFilter !== "all") query = query.eq("type", typeFilter);
    if (typeFilter === "ride_commission" && sourceFilter !== "all") query = query.eq("commission_source", sourceFilter);

    const { data } = await query;
    const txList = (data as Transaction[]) || [];

    const peopleIds = [...new Set([...txList.map((t) => t.driver_id), ...txList.map((t) => t.rider_id)].filter(Boolean))] as string[];
    const { data: people } = await supabase.from("profiles").select("id, full_name").in("id", peopleIds.length ? peopleIds : ["-"]);

    setTransactions(
      txList.map((t) => ({
        ...t,
        driverName: (people || []).find((p) => p.id === t.driver_id)?.full_name,
        riderName: (people || []).find((p) => p.id === t.rider_id)?.full_name,
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "driver")
      .order("full_name")
      .then(({ data }) => setDrivers((data as Profile[]) || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customFrom, customTo, driverFilter, typeFilter, sourceFilter]);

  function handleExport() {
    exportToCsv(
      `vuma-transactions-${format(new Date(), "yyyy-MM-dd")}`,
      transactions.map((t) => ({
        Date: format(new Date(t.created_at), "yyyy-MM-dd HH:mm"),
        Type: TYPE_LABELS[t.type] || t.type,
        Source: t.commission_source ? SOURCE_LABELS[t.commission_source] || t.commission_source : "",
        Driver: t.driverName || "",
        Rider: t.riderName || "",
        Amount: Number(t.amount),
        "Commission %": t.commission_pct ?? "",
        "Commission Amount": t.commission_amount ?? "",
        Currency: t.currency,
        Gateway: t.gateway || "",
        Status: t.status,
      }))
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/income-statement" className="btn-ghost !py-2 !px-3 text-sm">
            <FileBarChart className="w-4 h-4" /> Income Statement
          </Link>
          <button className="btn-primary !py-2 !px-3 text-sm" onClick={handleExport} disabled={!transactions.length}>
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["7d", "30d", "month", "all", "custom"] as DatePreset[]).map((p) => (
            <button
              key={p}
              className={`btn-ghost !py-1.5 !px-3 text-xs ${preset === p ? "!bg-navy-800 !text-paper !border-navy-800" : ""}`}
              onClick={() => setPreset(p)}
            >
              {p === "7d" ? "Last 7 days" : p === "30d" ? "Last 30 days" : p === "month" ? "This month" : p === "all" ? "All time" : "Custom"}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" className="input !py-2 text-sm" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span className="text-navy-400 text-sm">to</span>
            <input type="date" className="input !py-2 text-sm" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-3">
          <select className="input !py-2 text-sm" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}>
            <option value="all">All drivers</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
          <select
            className="input !py-2 text-sm"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setSourceFilter("all");
            }}
          >
            <option value="all">All types</option>
            {Object.entries(TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          {typeFilter === "ride_commission" && (
            <select className="input !py-2 text-sm" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="all">All commission types</option>
              {Object.entries(SOURCE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-navy-300">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-navy-400 border-b border-navy-100">
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Driver</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Commission</th>
                <th className="p-4 font-medium">Gateway</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-navy-50 last:border-0">
                  <td className="p-4 text-navy-400">{format(new Date(t.created_at), "d MMM yyyy, HH:mm")}</td>
                  <td className="p-4">
                    <p>{TYPE_LABELS[t.type] || t.type}</p>
                    {t.commission_source && (
                      <p className="text-xs text-navy-400">{SOURCE_LABELS[t.commission_source] || t.commission_source}</p>
                    )}
                  </td>
                  <td className="p-4">{t.driverName || "—"}</td>
                  <td className="p-4 fare-figure">{currencyFormat(Number(t.amount), t.currency)}</td>
                  <td className="p-4 fare-figure text-navy-400">
                    {t.commission_amount ? `${currencyFormat(Number(t.commission_amount), t.currency)} (${t.commission_pct}%)` : "—"}
                  </td>
                  <td className="p-4 capitalize">{t.gateway || "—"}</td>
                  <td className="p-4">
                    <StatusPill status={t.status} />
                  </td>
                </tr>
              ))}
              {!transactions.length && (
                <tr>
                  <td className="p-4 text-navy-400" colSpan={7}>
                    No transactions match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
