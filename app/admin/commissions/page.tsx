"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/constants";
import type { CountryCode, FareSettings } from "@/lib/types";
import { Loader2, Save } from "lucide-react";
import { useModal } from "@/components/ui/ModalProvider";

export default function AdminCommissionsPage() {
  const modal = useModal();
  const supabase = createClient();
  const [rates, setRates] = useState<Record<string, number>>({});
  const [fareSettings, setFareSettings] = useState<Record<string, FareSettings>>({});
  const [originalFareSettings, setOriginalFareSettings] = useState<Record<string, FareSettings>>({});
  const [loading, setLoading] = useState(true);
  const [savingCountry, setSavingCountry] = useState<string | null>(null);
  const [savingFareCountry, setSavingFareCountry] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("commission_settings").select("*");
      const map: Record<string, number> = {};
      (data || []).forEach((d) => (map[d.country] = Number(d.default_pct)));
      setRates(map);

      const { data: fareData } = await supabase.from("fare_settings").select("*");
      const fareMap: Record<string, FareSettings> = {};
      (fareData || []).forEach((f) => (fareMap[f.country] = f as FareSettings));
      setFareSettings(fareMap);
      setOriginalFareSettings(fareMap);

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(country: CountryCode) {
    setSavingCountry(country);
    await fetch("/api/admin/commission", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country, default_pct: rates[country] }),
    });
    setSavingCountry(null);
  }

  async function saveFareSettings(country: CountryCode) {
    const f = fareSettings[country];

    // The caps exist specifically to bound the maximum possible damage
    // from abuse or a future bug, independent of whether an individual
    // driver's balance is technically valid — see the persistent warning
    // rendered near these fields for the full reasoning. Loosening either
    // one is a deliberate reduction in that safety margin, so it gets an
    // explicit, restated confirmation rather than blending in with an
    // ordinary save.
    const prev = originalFareSettings[country];
    const increasedPerRider =
      prev && Number(f.change_credit_per_rider_monthly) > Number(prev.change_credit_per_rider_monthly);
    const increasedDriverCap =
      prev && Number(f.change_credit_driver_monthly) > Number(prev.change_credit_driver_monthly);

    if (increasedPerRider || increasedDriverCap) {
      const ok = await modal.confirm(
        `You're increasing the change-credit limit for ${COUNTRIES[country].label}. These caps exist as a deliberate fraud/abuse safeguard — they bound how much value can move through the change-credit system regardless of whether a driver's balance is technically valid, and they limit the maximum possible damage if any future bug or edge case is ever found. Raising them increases that exposure. Continue?`,
        { confirmLabel: "Yes, increase it", danger: true }
      );
      if (!ok) return;
    }

    setSavingFareCountry(country);
    const res = await fetch("/api/admin/fare-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country,
        base_fare: f.base_fare,
        per_km: f.per_km,
        low_multiplier: f.low_multiplier,
        high_multiplier: f.high_multiplier,
        round_to: f.round_to,
        deluxe_multiplier: f.deluxe_multiplier,
        scheduled_multiplier: f.scheduled_multiplier,
        change_credit_per_rider_monthly: f.change_credit_per_rider_monthly,
        change_credit_driver_monthly: f.change_credit_driver_monthly,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("[saveFareSettings] failed:", data.error);
      await modal.alert(`Could not save fare settings: ${data.error || "Unknown error"}`);
      setSavingFareCountry(null);
      return;
    }

    // Re-fetch from the database rather than trusting local state, so if
    // something silently didn't persist, this will show the real value
    // immediately instead of only revealing it on next page load.
    const { data: fresh, error: fetchErr } = await supabase.from("fare_settings").select("*").eq("country", country).single();
    if (fetchErr) {
      console.error("[saveFareSettings] saved, but could not re-fetch to confirm:", fetchErr);
    } else if (fresh) {
      setFareSettings((prev) => ({ ...prev, [country]: fresh as FareSettings }));
      setOriginalFareSettings((prev) => ({ ...prev, [country]: fresh as FareSettings }));
    }
    setSavingFareCountry(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Commissions</h1>
        <p className="text-navy-400 text-sm mt-1">
          Country-wide default commission, applied to any driver without an individual override or an active
          subscription plan that supersedes it.
        </p>
      </div>

      <div className="space-y-3">
        {(Object.keys(COUNTRIES) as CountryCode[]).map((c) => (
          <div key={c} className="card p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{COUNTRIES[c].label}</p>
              <p className="text-xs text-navy-400">Default commission on standard per-ride pricing</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                className="w-20 input !py-2 text-right fare-figure"
                value={rates[c] ?? ""}
                onChange={(e) => setRates((r) => ({ ...r, [c]: Number(e.target.value) }))}
              />
              <span className="text-navy-400">%</span>
              <button className="btn-dark !py-2" disabled={savingCountry === c} onClick={() => save(c)}>
                {savingCountry === c ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-navy-100 pt-8">
        <div className="mb-4">
          <p className="label mb-1">Fare guidance</p>
          <p className="text-navy-400 text-sm">
            The "fair range" shown to riders before they name their offer — guidance only, never a floor or
            cap. Formula: <span className="fare-figure">base fare + (road km × per-km rate)</span>, shown as a
            range using the low/high multipliers below.
          </p>
        </div>

        <div className="space-y-4">
          {(Object.keys(COUNTRIES) as CountryCode[]).map((c) => {
            const f = fareSettings[c];
            if (!f) return null;
            return (
              <div key={c} className="card p-5 space-y-3">
                <p className="font-semibold text-sm">
                  {COUNTRIES[c].label} <span className="text-navy-400 font-normal">({f.currency})</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  <div>
                    <label className="label block mb-1">Base fare</label>
                    <input
                      type="number"
                      step="0.1"
                      className="input !py-2"
                      value={f.base_fare}
                      onChange={(e) =>
                        setFareSettings((prev) => ({ ...prev, [c]: { ...f, base_fare: Number(e.target.value) } }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label block mb-1">Per km</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input !py-2"
                      value={f.per_km}
                      onChange={(e) => setFareSettings((prev) => ({ ...prev, [c]: { ...f, per_km: Number(e.target.value) } }))}
                    />
                  </div>
                  <div>
                    <label className="label block mb-1">Low ×</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input !py-2"
                      value={f.low_multiplier}
                      onChange={(e) =>
                        setFareSettings((prev) => ({ ...prev, [c]: { ...f, low_multiplier: Number(e.target.value) } }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label block mb-1">High ×</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input !py-2"
                      value={f.high_multiplier}
                      onChange={(e) =>
                        setFareSettings((prev) => ({ ...prev, [c]: { ...f, high_multiplier: Number(e.target.value) } }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label block mb-1">Round to</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      className="input !py-2"
                      value={f.round_to}
                      onChange={(e) => setFareSettings((prev) => ({ ...prev, [c]: { ...f, round_to: Number(e.target.value) } }))}
                    />
                  </div>
                  <div>
                    <label className="label block mb-1">Deluxe ×</label>
                    <input
                      type="number"
                      step="0.05"
                      min="1"
                      className="input !py-2"
                      value={f.deluxe_multiplier}
                      onChange={(e) =>
                        setFareSettings((prev) => ({ ...prev, [c]: { ...f, deluxe_multiplier: Number(e.target.value) } }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label block mb-1">Scheduled ×</label>
                    <input
                      type="number"
                      step="0.05"
                      min="1"
                      className="input !py-2"
                      value={f.scheduled_multiplier}
                      onChange={(e) =>
                        setFareSettings((prev) => ({ ...prev, [c]: { ...f, scheduled_multiplier: Number(e.target.value) } }))
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-navy-400">
                  Example: a 10 km trip suggests{" "}
                  <span className="fare-figure">
                    {COUNTRIES[c].currencySymbol}
                    {(Math.round(((f.base_fare + 10 * f.per_km)) / (f.round_to || 1)) * (f.round_to || 1)).toFixed(2)}
                  </span>{" "}
                  (range {COUNTRIES[c].currencySymbol}
                  {(Math.round(((f.base_fare + 10 * f.per_km) * f.low_multiplier) / (f.round_to || 1)) * (f.round_to || 1)).toFixed(2)}–
                  {COUNTRIES[c].currencySymbol}
                  {(Math.round(((f.base_fare + 10 * f.per_km) * f.high_multiplier) / (f.round_to || 1)) * (f.round_to || 1)).toFixed(2)}
                  ) &middot; Vuma Deluxe suggests{" "}
                  <span className="fare-figure">
                    {COUNTRIES[c].currencySymbol}
                    {(
                      Math.round(((f.base_fare + 10 * f.per_km) * f.deluxe_multiplier) / (f.round_to || 1)) * (f.round_to || 1)
                    ).toFixed(2)}
                  </span>{" "}
                  and {f.deluxe_multiplier}× commission &middot; a scheduled Deluxe trip stacks both, suggesting{" "}
                  <span className="fare-figure">
                    {COUNTRIES[c].currencySymbol}
                    {(
                      Math.round(
                        ((f.base_fare + 10 * f.per_km) * f.deluxe_multiplier * f.scheduled_multiplier) / (f.round_to || 1)
                      ) * (f.round_to || 1)
                    ).toFixed(2)}
                  </span>{" "}
                  and {(f.deluxe_multiplier * f.scheduled_multiplier).toFixed(2)}× commission
                </p>

                <div className="border-t border-navy-100 pt-4">
                  <p className="label mb-2">Change-credit monthly caps</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="label block mb-1">Max to one rider/month</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        className="input !py-2"
                        value={f.change_credit_per_rider_monthly ?? ""}
                        onChange={(e) =>
                          setFareSettings((prev) => ({
                            ...prev,
                            [c]: { ...f, change_credit_per_rider_monthly: Number(e.target.value) },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label block mb-1">Max total/month, any rider</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        className="input !py-2"
                        value={f.change_credit_driver_monthly ?? ""}
                        onChange={(e) =>
                          setFareSettings((prev) => ({
                            ...prev,
                            [c]: { ...f, change_credit_driver_monthly: Number(e.target.value) },
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="bg-coral-500/5 border border-coral-500/20 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-coral-700">
                      <strong>Before raising either limit:</strong> these caps aren't about whether a driver's
                      balance is technically valid — they bound how much value can move through the change-credit
                      system even when it is. They're the backstop that limits maximum possible damage if a future
                      bug or an abuse pattern is ever found, independent of any other safeguard already in place.
                      Raising them is a deliberate reduction in that safety margin, not a routine adjustment.
                    </p>
                  </div>
                </div>

                <button
                  className="btn-dark !py-2"
                  disabled={savingFareCountry === c}
                  onClick={() => saveFareSettings(c)}
                >
                  {savingFareCountry === c ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
