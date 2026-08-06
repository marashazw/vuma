"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { EMERGENCY_NUMBERS } from "@/lib/constants";
import type { CountryCode, SosAlert, SosResponse, SecurityProvider } from "@/lib/types";
import { AlertTriangle, Phone, Loader2, ShieldCheck, X, Shield } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  notified: "Notified",
  acknowledged: "Acknowledged",
  notified_police: "Notified police",
  attending: "Heading to scene",
  arrived: "Arrived",
  no_response: "No response",
};

export function SosPanel({ rideId, country, isDeluxe }: { rideId: string; country: CountryCode; isDeluxe: boolean }) {
  const supabase = createClient();
  const [confirming, setConfirming] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [alert, setAlert] = useState<SosAlert | null>(null);
  const [responses, setResponses] = useState<SosResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [securityProvider, setSecurityProvider] = useState<SecurityProvider | null>(null);

  const loadResponses = useCallback(
    async (alertId: string) => {
      const { data } = await supabase
        .from("sos_responses")
        .select("*")
        .eq("sos_alert_id", alertId)
        .order("distance_km", { ascending: true });
      setResponses((data as SosResponse[]) || []);
    },
    [supabase]
  );

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("sos_alerts")
        .select("*")
        .eq("ride_id", rideId)
        .eq("triggered_by", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (data) {
        setAlert(data as SosAlert);
        loadResponses(data.id);
      }
    })();
  }, [rideId, supabase, loadResponses]);

  useEffect(() => {
    if (!alert) return;
    const channel = supabase
      .channel(`sos-${alert.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sos_responses", filter: `sos_alert_id=eq.${alert.id}` },
        () => loadResponses(alert.id)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [alert, supabase, loadResponses]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("security_providers").select("*").eq("country", country).single();
      setSecurityProvider(data as SecurityProvider);
    })();
  }, [country, supabase]);

  async function callSecurityProvider() {
    if (!alert) return;
    // Best-effort tracking — never block the actual tel: link on this.
    fetch("/api/sos/notify-security-provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertId: alert.id }),
    }).catch(() => {});
  }

  async function trigger() {
    setTriggering(true);
    setError(null);
    if (!navigator.geolocation) {
      setError("Location access is required to raise an SOS.");
      setTriggering(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await fetch("/api/sos/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rideId, lat: pos.coords.latitude, lng: pos.coords.longitude }),
        });
        const data = await res.json();
        setTriggering(false);
        setConfirming(false);
        if (!res.ok) {
          setError(data.error || "Could not raise SOS");
          return;
        }
        const { data: alertRow } = await supabase.from("sos_alerts").select("*").eq("id", data.alertId).single();
        setAlert(alertRow as SosAlert);
      },
      () => {
        setError("Could not get your location.");
        setTriggering(false);
      }
    );
  }

  async function markSafe() {
    if (!alert) return;
    await fetch("/api/sos/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertId: alert.id, status: "resolved" }),
    });
    setAlert(null);
    setResponses([]);
  }

  const numbers = EMERGENCY_NUMBERS[country];

  if (!alert) {
    return (
      <div>
        {!confirming ? (
          <button className="btn-danger w-full" onClick={() => setConfirming(true)}>
            <AlertTriangle className="w-4 h-4" /> SOS — I need help
          </button>
        ) : (
          <div className="card p-5 border-coral-500/30 bg-coral-500/5">
            <p className="font-semibold text-coral-700 mb-1">Raise an emergency alert?</p>
            <p className="text-sm text-coral-600 mb-4">
              This notifies the nearest 5 verified drivers with your location and this trip&rsquo;s vehicle details, and
              prompts you to call emergency services. Only use this if you are genuinely in danger.
            </p>
            {error && <p className="text-sm text-coral-700 mb-3">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button className="btn-ghost" onClick={() => setConfirming(false)} disabled={triggering}>
                Cancel
              </button>
              <button className="btn-danger" onClick={trigger} disabled={triggering}>
                {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />} Confirm SOS
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card p-5 border-coral-500/30 bg-coral-500/5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-coral-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> SOS active
        </p>
        <button onClick={markSafe} className="text-xs text-navy-400 flex items-center gap-1">
          <X className="w-3.5 h-3.5" /> I&rsquo;m safe now
        </button>
      </div>

      <div className="grid gap-2">
        {isDeluxe && securityProvider?.is_active && securityProvider.rapid_response_number && (
          <a
            href={`tel:${securityProvider.rapid_response_number}`}
            onClick={callSecurityProvider}
            className="btn-dark w-full !bg-navy-800"
          >
            <Shield className="w-4 h-4 text-gold-400" /> Call {securityProvider.provider_name} (
            {securityProvider.rapid_response_number})
          </a>
        )}
        {numbers.map((n) => (
          <a key={n.number} href={`tel:${n.number}`} className="btn-danger w-full">
            <Phone className="w-4 h-4" /> Call {n.label} ({n.number})
          </a>
        ))}
      </div>
      {!isDeluxe && securityProvider?.is_active && securityProvider.rapid_response_number && (
        <p className="text-xs text-navy-400 -mt-1">
          Private security rapid-response is a Vuma Deluxe benefit — book a Deluxe ride next time for this option
          during an SOS.
        </p>
      )}

      <div>
        <p className="label mb-2">Nearby drivers notified ({responses.length})</p>
        <ul className="space-y-1.5">
          {responses.map((r) => (
            <li key={r.id} className="flex items-center justify-between text-sm">
              <span className="text-navy-500">{r.distance_km ? `${r.distance_km} km away` : "Nearby driver"}</span>
              <span
                className={
                  r.status === "notified"
                    ? "text-navy-400"
                    : r.status === "arrived"
                    ? "text-jade-600 font-semibold"
                    : "text-gold-600 font-semibold"
                }
              >
                {STATUS_LABELS[r.status] || r.status}
              </span>
            </li>
          ))}
          {!responses.length && <li className="text-sm text-navy-400">No online drivers nearby were found.</li>}
        </ul>
      </div>
    </div>
  );
}
