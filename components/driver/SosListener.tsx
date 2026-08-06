"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { EMERGENCY_NUMBERS } from "@/lib/constants";
import type { SosAlert, SosResponse, CountryCode, SecurityProvider } from "@/lib/types";
import { AlertTriangle, Phone, Navigation, ShieldCheck, Loader2, Shield } from "lucide-react";

export function SosListener() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [country, setCountry] = useState<CountryCode>("ZA");
  const [response, setResponse] = useState<SosResponse | null>(null);
  const [alert, setAlert] = useState<SosAlert | null>(null);
  const [policeRef, setPoliceRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPoliceForm, setShowPoliceForm] = useState(false);
  const [securityProvider, setSecurityProvider] = useState<SecurityProvider | null>(null);

  const loadActive = useCallback(
    async (uid: string) => {
      const { data } = await supabase
        .from("sos_responses")
        .select("*")
        .eq("driver_id", uid)
        .in("status", ["notified", "acknowledged", "notified_police", "attending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        setResponse(null);
        setAlert(null);
        return;
      }
      setResponse(data as SosResponse);
      const { data: alertRow } = await supabase.from("sos_alerts").select("*").eq("id", data.sos_alert_id).single();
      if (alertRow?.status !== "active") {
        setResponse(null);
        setAlert(null);
      } else {
        setAlert(alertRow as SosAlert);
      }
    },
    [supabase]
  );

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("country").eq("id", user.id).single();
      if (profile?.country) setCountry(profile.country as CountryCode);
      const { data: provider } = await supabase
        .from("security_providers")
        .select("*")
        .eq("country", (profile?.country as CountryCode) || "ZA")
        .single();
      setSecurityProvider(provider as SecurityProvider);
      loadActive(user.id);
    })();
  }, [supabase, loadActive]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`sos-listener-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sos_responses", filter: `driver_id=eq.${userId}` },
        () => loadActive(userId)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, loadActive]);

  async function respond(status: string, extra?: { policeReference?: string }) {
    if (!response) return;
    setBusy(true);
    await fetch("/api/sos/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responseId: response.id, status, ...extra }),
    });
    setBusy(false);
    setShowPoliceForm(false);
    if (userId) loadActive(userId);
  }

  function callSecurityProvider() {
    if (!alert) return;
    fetch("/api/sos/notify-security-provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertId: alert.id }),
    }).catch(() => {});
  }

  if (!alert || !response) return null;

  const isBlocking = response.status === "notified" || response.status === "acknowledged";
  const numbers = EMERGENCY_NUMBERS[country];

  const content = (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-coral-600">
        <AlertTriangle className="w-5 h-5" />
        <p className="font-display font-bold text-lg">Nearby SOS alert</p>
      </div>
      <p className="text-sm text-navy-500">
        A {alert.triggered_by_role} raised an emergency near you
        {response.distance_km ? ` (about ${response.distance_km} km away)` : ""}. As a nearby driver, please respond.
      </p>

      {(alert.vehicle_plate || alert.vehicle_description || alert.involved_driver_name) && (
        <div className="card p-4 bg-navy-50 border-navy-100 space-y-1 text-sm">
          {alert.involved_driver_name && (
            <p>
              <span className="text-navy-400">Driver involved:</span> {alert.involved_driver_name}
            </p>
          )}
          {alert.vehicle_plate && (
            <p>
              <span className="text-navy-400">Plate:</span> {alert.vehicle_plate}
            </p>
          )}
          {alert.vehicle_description && (
            <p>
              <span className="text-navy-400">Vehicle:</span> {alert.vehicle_description}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-2">
        {alert?.is_deluxe && securityProvider?.is_active && securityProvider.rapid_response_number && (
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

      {!showPoliceForm ? (
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-dark" disabled={busy} onClick={() => respond("attending")}>
            <Navigation className="w-4 h-4" /> Heading there
          </button>
          <button className="btn-ghost" disabled={busy} onClick={() => setShowPoliceForm(true)}>
            <ShieldCheck className="w-4 h-4" /> Notified police
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            className="input"
            placeholder="Police case/reference number (if given)"
            value={policeRef}
            onChange={(e) => setPoliceRef(e.target.value)}
          />
          <button
            className="btn-primary w-full"
            disabled={busy}
            onClick={() => respond("notified_police", { policeReference: policeRef })}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Confirm
          </button>
        </div>
      )}

      {response.status === "attending" && (
        <button className="btn-ghost w-full" disabled={busy} onClick={() => respond("arrived")}>
          I&rsquo;ve arrived at the scene
        </button>
      )}
    </div>
  );

  if (isBlocking) {
    return (
      <div className="fixed inset-0 z-[100] bg-navy-900/80 backdrop-blur-sm flex items-center justify-center p-5">
        <div className="card p-6 w-full max-w-sm">{content}</div>
      </div>
    );
  }

  // Already responding — keep visible but non-blocking.
  return (
    <div className="fixed bottom-20 sm:bottom-5 left-5 right-5 z-40 mx-auto max-w-sm">
      <div className="card p-5 border-gold-300 bg-gold-50/95 backdrop-blur">{content}</div>
    </div>
  );
}
