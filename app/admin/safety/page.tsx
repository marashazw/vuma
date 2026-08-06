"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatusPill } from "@/components/ui/StatusPill";
import { COUNTRIES } from "@/lib/constants";
import type { SosAlert, SosResponse, Profile, SecurityProvider, CountryCode } from "@/lib/types";
import { Loader2, AlertTriangle, Gift, CheckCircle2, Shield, Save } from "lucide-react";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  notified: "Notified",
  acknowledged: "Acknowledged",
  notified_police: "Notified police",
  attending: "Heading to scene",
  arrived: "Arrived",
  no_response: "No response",
};

export default function AdminSafetyPage() {
  const supabase = createClient();
  const [alerts, setAlerts] = useState<(SosAlert & { triggeredByProfile?: Profile })[]>([]);
  const [responses, setResponses] = useState<Record<string, (SosResponse & { profile?: Profile })[]>>({});
  const [providers, setProviders] = useState<Record<string, SecurityProvider>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingProviderCountry, setSavingProviderCountry] = useState<string | null>(null);

  async function load() {
    const { data: alertsData } = await supabase
      .from("sos_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    const triggerIds = [...new Set((alertsData || []).map((a) => a.triggered_by))];
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", triggerIds.length ? triggerIds : ["-"]);

    setAlerts(
      (alertsData || []).map((a) => ({
        ...a,
        triggeredByProfile: (profiles || []).find((p) => p.id === a.triggered_by),
      }))
    );

    const alertIds = (alertsData || []).map((a) => a.id);
    if (alertIds.length) {
      const { data: responsesData } = await supabase
        .from("sos_responses")
        .select("*")
        .in("sos_alert_id", alertIds)
        .order("distance_km", { ascending: true });

      const driverIds = [...new Set((responsesData || []).map((r) => r.driver_id))];
      const { data: driverProfiles } = await supabase.from("profiles").select("*").in("id", driverIds.length ? driverIds : ["-"]);

      const grouped: Record<string, (SosResponse & { profile?: Profile })[]> = {};
      (responsesData || []).forEach((r: any) => {
        const withProfile = { ...r, profile: (driverProfiles || []).find((p) => p.id === r.driver_id) };
        grouped[r.sos_alert_id] = [...(grouped[r.sos_alert_id] || []), withProfile];
      });
      setResponses(grouped);
    }

    const { data: providersData } = await supabase.from("security_providers").select("*");
    const map: Record<string, SecurityProvider> = {};
    (providersData || []).forEach((p) => (map[p.country] = p as SecurityProvider));
    setProviders(map);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reward(responseId: string) {
    setBusyId(responseId);
    await fetch("/api/admin/sos/reward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responseId, freeRides: 1, priorityDays: 14, badge: "sos_responder" }),
    });
    await load();
    setBusyId(null);
  }

  async function saveProvider(country: CountryCode) {
    const p = providers[country];
    setSavingProviderCountry(country);
    await fetch("/api/admin/security-provider", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country,
        provider_name: p.provider_name,
        rapid_response_number: p.rapid_response_number,
        control_room_number: p.control_room_number,
        account_reference: p.account_reference,
        coverage_notes: p.coverage_notes,
        is_active: p.is_active,
      }),
    });
    setSavingProviderCountry(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Safety</h1>
        <p className="text-navy-400 text-sm mt-1">
          SOS alerts and driver responses. Reward drivers who acted with a free-ride commission credit, priority
          ranking, and a trust badge.
        </p>
      </div>

      <div>
        <p className="label mb-3 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-navy-600" /> Third-party security provider
        </p>
        <p className="text-navy-400 text-sm mb-3">
          A private security / armed response provider shown as a rapid-response call option during an active SOS,
          alongside standard emergency numbers. <strong>Restricted to Vuma Deluxe rides</strong> — a marketed
          enhanced-security benefit of that tier, not shown for regular rides. Kept off until you fill in real
          details below.
        </p>
        <div className="space-y-3">
          {(Object.keys(COUNTRIES) as CountryCode[]).map((c) => {
            const p = providers[c];
            if (!p) return null;
            return (
              <div key={c} className="card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{COUNTRIES[c].label}</p>
                  <label className="flex items-center gap-2 text-xs text-navy-500">
                    <input
                      type="checkbox"
                      checked={p.is_active}
                      onChange={(e) => setProviders((prev) => ({ ...prev, [c]: { ...p, is_active: e.target.checked } }))}
                    />
                    Show to users
                  </label>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label block mb-1">Provider name</label>
                    <input
                      className="input !py-2"
                      value={p.provider_name || ""}
                      onChange={(e) => setProviders((prev) => ({ ...prev, [c]: { ...p, provider_name: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <label className="label block mb-1">Rapid response number</label>
                    <input
                      className="input !py-2"
                      placeholder="e.g. 0861 123 456"
                      value={p.rapid_response_number || ""}
                      onChange={(e) =>
                        setProviders((prev) => ({ ...prev, [c]: { ...p, rapid_response_number: e.target.value } }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label block mb-1">Control room number (optional)</label>
                    <input
                      className="input !py-2"
                      value={p.control_room_number || ""}
                      onChange={(e) =>
                        setProviders((prev) => ({ ...prev, [c]: { ...p, control_room_number: e.target.value } }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label block mb-1">Account/client reference (optional)</label>
                    <input
                      className="input !py-2"
                      value={p.account_reference || ""}
                      onChange={(e) =>
                        setProviders((prev) => ({ ...prev, [c]: { ...p, account_reference: e.target.value } }))
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label block mb-1">Coverage notes (optional)</label>
                    <input
                      className="input !py-2"
                      placeholder="e.g. Harare CBD and northern suburbs only"
                      value={p.coverage_notes || ""}
                      onChange={(e) => setProviders((prev) => ({ ...prev, [c]: { ...p, coverage_notes: e.target.value } }))}
                    />
                  </div>
                </div>
                <button className="btn-dark !py-2" disabled={savingProviderCountry === c} onClick={() => saveProvider(c)}>
                  {savingProviderCountry === c ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-navy-100 pt-8 space-y-3">
        <p className="label">Alerts</p>
        {!alerts.length && <p className="text-navy-400 text-sm">No SOS alerts have been raised.</p>}

        {alerts.map((a) => (
          <div key={a.id} className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-coral-500" />
                {a.triggeredByProfile?.full_name || "Unknown"} ({a.triggered_by_role})
              </p>
              <div className="flex items-center gap-2">
                {a.security_provider_notified && (
                  <span className="pill bg-navy-800 text-gold-400 !text-[10px]">
                    <Shield className="w-3 h-3" /> Security called
                  </span>
                )}
                <StatusPill status={a.status} />
              </div>
            </div>
            <p className="text-xs text-navy-400">{format(new Date(a.created_at), "d MMM yyyy, HH:mm")}</p>

            {(a.vehicle_plate || a.involved_driver_name) && (
              <div className="text-sm bg-navy-50 rounded-lg p-3">
                {a.involved_driver_name && <p>Driver involved: {a.involved_driver_name}</p>}
                {a.vehicle_plate && <p>Plate: {a.vehicle_plate}</p>}
                {a.vehicle_description && <p>Vehicle: {a.vehicle_description}</p>}
              </div>
            )}

            <div>
              <p className="label mb-2">Responders</p>
              <ul className="space-y-2">
                {(responses[a.id] || []).map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm border-b border-navy-50 last:border-0 pb-2 last:pb-0">
                    <div>
                      <p className="font-medium">{r.profile?.full_name || "Driver"}</p>
                      <p className="text-xs text-navy-400">
                        {r.distance_km ? `${r.distance_km} km away` : ""} &middot; {STATUS_LABELS[r.status] || r.status}
                        {r.police_reference ? ` (ref: ${r.police_reference})` : ""}
                      </p>
                    </div>
                    {r.rewarded ? (
                      <span className="pill bg-jade-50 text-jade-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Rewarded
                      </span>
                    ) : r.status !== "notified" ? (
                      <button className="btn-ghost !py-1.5 !px-3 text-xs" disabled={busyId === r.id} onClick={() => reward(r.id)}>
                        <Gift className="w-3.5 h-3.5" /> Reward
                      </button>
                    ) : (
                      <span className="text-xs text-navy-300">Awaiting response</span>
                    )}
                  </li>
                ))}
                {!(responses[a.id] || []).length && <li className="text-xs text-navy-400">No drivers were nearby to notify.</li>}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
