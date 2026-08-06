"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/constants";
import { StatusPill } from "@/components/ui/StatusPill";
import { currencyFormat } from "@/lib/commission";
import type { ReferralSettings, DriverReferralSettings, CountryCode, Referral, DriverReferral, Profile } from "@/lib/types";
import { Loader2, Save, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function AdminReferralsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<Record<string, ReferralSettings>>({});
  const [referrals, setReferrals] = useState<(Referral & { referrer?: Profile; referred?: Profile })[]>([]);
  const [driverSettings, setDriverSettings] = useState<Record<string, DriverReferralSettings>>({});
  const [driverReferrals, setDriverReferrals] = useState<
    (DriverReferral & { referrer?: Profile; referred?: Profile; referredFlagged?: boolean })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [savingCountry, setSavingCountry] = useState<string | null>(null);
  const [savingDriverCountry, setSavingDriverCountry] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("referral_settings").select("*");
    const map: Record<string, ReferralSettings> = {};
    (data || []).forEach((s) => (map[s.country] = s as ReferralSettings));
    setSettings(map);

    const { data: referralsData } = await supabase
      .from("referrals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    const ids = [...new Set((referralsData || []).flatMap((r) => [r.referrer_id, r.referred_id]))];
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids.length ? ids : ["-"]);

    setReferrals(
      (referralsData || []).map((r: any) => ({
        ...r,
        referrer: (profiles || []).find((p) => p.id === r.referrer_id),
        referred: (profiles || []).find((p) => p.id === r.referred_id),
      }))
    );

    const { data: driverSettingsData } = await supabase.from("driver_referral_settings").select("*");
    const driverMap: Record<string, DriverReferralSettings> = {};
    (driverSettingsData || []).forEach((s) => (driverMap[s.country] = s as DriverReferralSettings));
    setDriverSettings(driverMap);

    const { data: driverReferralsData } = await supabase
      .from("driver_referrals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    const driverIds = [...new Set((driverReferralsData || []).flatMap((r) => [r.referrer_id, r.referred_id]))];
    const { data: driverProfiles } = await supabase.from("profiles").select("*").in("id", driverIds.length ? driverIds : ["-"]);
    const { data: driverFlags } = await supabase
      .from("driver_profiles")
      .select("user_id, duplicate_vehicle_flag")
      .in("user_id", driverIds.length ? driverIds : ["-"]);

    setDriverReferrals(
      (driverReferralsData || []).map((r: any) => ({
        ...r,
        referrer: (driverProfiles || []).find((p) => p.id === r.referrer_id),
        referred: (driverProfiles || []).find((p) => p.id === r.referred_id),
        referredFlagged: (driverFlags || []).find((f) => f.user_id === r.referred_id)?.duplicate_vehicle_flag || false,
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(country: CountryCode) {
    const s = settings[country];
    setSavingCountry(country);
    await fetch("/api/admin/referrals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country,
        required_referrals: s.required_referrals,
        credit_amount: s.credit_amount,
        driver_priority_days: s.driver_priority_days,
        is_active: s.is_active,
      }),
    });
    setSavingCountry(null);
  }

  async function saveDriverSettings(country: CountryCode) {
    const s = driverSettings[country];
    setSavingDriverCountry(country);
    await fetch("/api/admin/driver-referrals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country,
        required_referrals: s.required_referrals,
        credit_amount: s.credit_amount,
        min_rides_to_qualify: s.min_rides_to_qualify,
        is_active: s.is_active,
      }),
    });
    setSavingDriverCountry(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Referral programs</h1>
        <p className="text-navy-400 text-sm mt-1">
          Rider referrals earn a free ride credit. Driver referrals earn spendable credit toward a subscription or
          priority boost.
        </p>
      </div>

      <div>
        <p className="label mb-3">Rider referral program</p>
        <div className="space-y-3">
          {(Object.keys(COUNTRIES) as CountryCode[]).map((c) => {
            const s = settings[c];
            if (!s) return null;
            return (
              <div key={c} className="card p-5 grid sm:grid-cols-4 gap-3 items-end">
                <div>
                  <p className="font-semibold text-sm mb-2">{COUNTRIES[c].label}</p>
                  <label className="label block mb-1">Friends required</label>
                  <input
                    type="number"
                    className="input !py-2"
                    value={s.required_referrals}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, [c]: { ...s, required_referrals: Number(e.target.value) } }))
                    }
                  />
                </div>
                <div>
                  <label className="label block mb-1">Credit amount ({s.currency})</label>
                  <input
                    type="number"
                    className="input !py-2"
                    value={s.credit_amount}
                    onChange={(e) => setSettings((prev) => ({ ...prev, [c]: { ...s, credit_amount: Number(e.target.value) } }))}
                  />
                </div>
                <div>
                  <label className="label block mb-1">Driver priority (days)</label>
                  <input
                    type="number"
                    className="input !py-2"
                    value={s.driver_priority_days}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, [c]: { ...s, driver_priority_days: Number(e.target.value) } }))
                    }
                  />
                </div>
                <button className="btn-dark !py-2.5" disabled={savingCountry === c} onClick={() => save(c)}>
                  {savingCountry === c ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="label mb-3">Recent rider referrals</p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-navy-400 border-b border-navy-100">
                <th className="p-4 font-medium">Referrer</th>
                <th className="p-4 font-medium">Referred friend</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} className="border-b border-navy-50 last:border-0">
                  <td className="p-4">{r.referrer?.full_name || "—"}</td>
                  <td className="p-4">{r.referred?.full_name || "—"}</td>
                  <td className="p-4">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="p-4 text-navy-400">{format(new Date(r.created_at), "d MMM yyyy")}</td>
                </tr>
              ))}
              {!referrals.length && (
                <tr>
                  <td className="p-4 text-navy-400" colSpan={4}>
                    No referrals yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-navy-100 pt-8">
        <p className="label mb-3">Driver referral program</p>
        <div className="space-y-3">
          {(Object.keys(COUNTRIES) as CountryCode[]).map((c) => {
            const s = driverSettings[c];
            if (!s) return null;
            return (
              <div key={c} className="card p-5 grid sm:grid-cols-5 gap-3 items-end">
                <div>
                  <p className="font-semibold text-sm mb-2">{COUNTRIES[c].label}</p>
                  <label className="label block mb-1">Drivers required</label>
                  <input
                    type="number"
                    className="input !py-2"
                    value={s.required_referrals}
                    onChange={(e) =>
                      setDriverSettings((prev) => ({ ...prev, [c]: { ...s, required_referrals: Number(e.target.value) } }))
                    }
                  />
                </div>
                <div>
                  <label className="label block mb-1">Min. rides to qualify</label>
                  <input
                    type="number"
                    className="input !py-2"
                    value={s.min_rides_to_qualify}
                    onChange={(e) =>
                      setDriverSettings((prev) => ({ ...prev, [c]: { ...s, min_rides_to_qualify: Number(e.target.value) } }))
                    }
                  />
                </div>
                <div>
                  <label className="label block mb-1">Credit amount ({s.currency})</label>
                  <input
                    type="number"
                    step="0.1"
                    className="input !py-2"
                    value={s.credit_amount}
                    onChange={(e) =>
                      setDriverSettings((prev) => ({ ...prev, [c]: { ...s, credit_amount: Number(e.target.value) } }))
                    }
                  />
                </div>
                <button
                  className="btn-dark !py-2.5"
                  disabled={savingDriverCountry === c}
                  onClick={() => saveDriverSettings(c)}
                >
                  {savingDriverCountry === c ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="label mb-3">Recent driver referrals</p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-navy-400 border-b border-navy-100">
                <th className="p-4 font-medium">Referrer</th>
                <th className="p-4 font-medium">Referred driver</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {driverReferrals.map((r) => (
                <tr key={r.id} className="border-b border-navy-50 last:border-0">
                  <td className="p-4">{r.referrer?.full_name || "—"}</td>
                  <td className="p-4 flex items-center gap-1.5">
                    {r.referred?.full_name || "—"}
                    {r.referredFlagged && (
                      <span title="Duplicate vehicle plate detected">
                        <AlertTriangle className="w-3.5 h-3.5 text-coral-500" />
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="p-4 text-navy-400">{format(new Date(r.created_at), "d MMM yyyy")}</td>
                </tr>
              ))}
              {!driverReferrals.length && (
                <tr>
                  <td className="p-4 text-navy-400" colSpan={4}>
                    No driver referrals yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
