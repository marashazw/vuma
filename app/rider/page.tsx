"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LocationSearchInput } from "@/components/map/LocationSearchInput";
import { NearbyDriversBadge } from "@/components/rider/NearbyDriversBadge";
import { EditableLocationBadge } from "@/components/rider/EditableLocationBadge";
import { checkRideAccessRestriction } from "@/lib/vumaAssociates";
import { TripReminder } from "@/components/ui/TripReminder";
import { suggestedFareRange, reverseGeocode, getRoadRoute, type RoadRoute } from "@/lib/geo";
import { getWeatherAdvisory, type WeatherAdvisory } from "@/lib/weather";
import { COUNTRIES } from "@/lib/constants";
import type { CountryCode, FareSettings } from "@/lib/types";
import { currencyFormat } from "@/lib/commission";
import type { RideCredit } from "@/lib/types";
import { Loader2, Navigation, Gift, Users, Wallet, Sparkles, X, Plus, CloudRain, Snowflake, Sun, CalendarClock } from "lucide-react";

const RideMap = dynamic(() => import("@/components/map/RideMap"), { ssr: false });

interface Point {
  label: string;
  lat: number;
  lng: number;
}

export default function RiderHomePage() {
  const supabase = createClient();
  const router = useRouter();

  const [country, setCountry] = useState<CountryCode>("ZA");
  const [pickup, setPickup] = useState<Point | null>(null);
  const [dropoff, setDropoff] = useState<Point | null>(null);
  const [stops, setStops] = useState<Point[]>([]);
  const [offer, setOffer] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [liveLocation, setLiveLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const retryLocationRef = useRef<() => void>(() => {});
  const [route, setRoute] = useState<(RoadRoute & { estimated: boolean }) | null>(null);
  const [weatherAdvisory, setWeatherAdvisory] = useState<WeatherAdvisory | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [credits, setCredits] = useState<RideCredit[]>([]);
  const [selectedCreditId, setSelectedCreditId] = useState<string | null>(null);
  const [seatsRequired, setSeatsRequired] = useState(1);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletCurrency, setWalletCurrency] = useState<string | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [fareSettings, setFareSettings] = useState<FareSettings | null>(null);
  const [isDeluxe, setIsDeluxe] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("country, wallet_balance, wallet_currency")
          .eq("id", user.id)
          .single();
        if (profile?.country) setCountry(profile.country as CountryCode);
        setWalletBalance(Number(profile?.wallet_balance) || 0);
        setWalletCurrency(profile?.wallet_currency || null);

        const { data: fareData, error: fareErr } = await supabase
          .from("fare_settings")
          .select("*")
          .eq("country", (profile?.country as CountryCode) || "ZA")
          .single();
        if (fareErr) {
          console.error("[rider] fare_settings fetch failed, will use fallback constants:", fareErr);
        } else {
          console.log("[rider] fare_settings loaded:", fareData);
        }
        setFareSettings(fareData as FareSettings);

        const { data: creditsData } = await supabase
          .from("ride_credits")
          .select("*")
          .eq("rider_id", user.id)
          .eq("status", "available");
        setCredits((creditsData as RideCredit[]) || []);
      }
    })();

    function tryLocate() {
      if (typeof window !== "undefined" && navigator.geolocation) {
        setLocating(true);
        setLocationError(false);
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            const label = (await reverseGeocode(latitude, longitude)) || "Current location";
            setPickup({ label, lat: latitude, lng: longitude });
            setLocating(false);
          },
          () => {
            setLocating(false);
            setLocationError(true);
          },
          { timeout: 8000 }
        );
      } else {
        setLocating(false);
        setLocationError(true);
      }
    }
    tryLocate();
    retryLocationRef.current = tryLocate;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Continuous live position tracking, independent of the pickup point
  // above — GPS itself works with no internet connection, so this keeps
  // the "you are here" dot moving on the map even when fully offline,
  // matching what a rider would see in a native map app.
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setLiveLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsOffline(!navigator.onLine);
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!pickup || !dropoff) {
      setRoute(null);
      return;
    }
    const selectedStops = stops.filter((s) => s.label);
    setRouteLoading(true);
    getRoadRoute(pickup, dropoff, country, selectedStops)
      .then(setRoute)
      .finally(() => setRouteLoading(false));
  }, [pickup, dropoff, country, stops]);

  // Weather advisory — fetched once a destination is set (a route exists),
  // shown near the offer section. Best-effort only: never blocks the
  // request flow if the weather service is unavailable.
  useEffect(() => {
    if (!dropoff) {
      setWeatherAdvisory(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/weather?lat=${dropoff.lat}&lng=${dropoff.lng}`);
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.error("[weather] /api/weather returned", res.status, errText);
          if (!cancelled) setWeatherAdvisory({ message: "Couldn't check the weather for this trip right now.", icon: "pleasant" });
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        console.log("[weather] data:", data);
        setWeatherAdvisory(getWeatherAdvisory(data.tempC, data.precipitationMm, data.weatherCode, dropoff.label));
      } catch (err) {
        console.error("[weather] fetch threw:", err);
        if (!cancelled) setWeatherAdvisory({ message: "Couldn't check the weather for this trip right now.", icon: "pleasant" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dropoff?.lat, dropoff?.lng, dropoff?.label]);

  const cfg = COUNTRIES[country];

  // 30-minute minimum lead time for a scheduled ride, per policy — computed
  // fresh on every render so it stays accurate as time passes while the
  // rider is filling out the form.
  const minScheduleDate = new Date(Date.now() + 30 * 60 * 1000);
  const minScheduleDatetimeLocal = new Date(minScheduleDate.getTime() - minScheduleDate.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  const isScheduledTimeValid = !isScheduled || (!!scheduledAt && new Date(scheduledAt) >= minScheduleDate);
  const deluxeMultiplier = isDeluxe ? (fareSettings?.deluxe_multiplier ?? 1.5) : 1;
  const scheduledMultiplier = isScheduled ? (fareSettings?.scheduled_multiplier ?? 1.2) : 1;
  const combinedMultiplier = deluxeMultiplier * scheduledMultiplier;
  const range = route
    ? suggestedFareRange(
        route.distanceKm,
        (fareSettings?.base_fare ?? cfg.fallbackBaseFare) * combinedMultiplier,
        (fareSettings?.per_km ?? cfg.fallbackPerKm) * combinedMultiplier,
        fareSettings?.low_multiplier ?? 0.85,
        fareSettings?.high_multiplier ?? 1.2,
        fareSettings?.round_to ?? cfg.fallbackRoundTo
      )
    : null;

  useEffect(() => {
    if (range) setOffer(isDeluxe ? range.low : range.mid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, isDeluxe]);

  async function requestRide() {
    if (!pickup || !dropoff || !offer || !route) return;
    if (!isScheduledTimeValid) return;
    setSubmitting(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const restrictionCheck = await checkRideAccessRestriction(supabase, user.id, isDeluxe);
    if (restrictionCheck.restricted) {
      setError(restrictionCheck.reason || "This isn't currently available to you.");
      setSubmitting(false);
      return;
    }

    const walletApplyAmount = useWallet ? Math.min(walletBalance, Number(offer)) : 0;

    const { data, error: insertErr } = await supabase
      .from("rides")
      .insert({
        rider_id: user.id,
        pickup_address: pickup.label,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_address: dropoff.label,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        distance_km: route.distanceKm,
        suggested_fare: range?.mid,
        rider_offer: offer,
        currency: cfg.currency,
        country,
        status: "requested",
        applied_credit_id: selectedCreditId,
        seats_required: seatsRequired,
        wallet_applied: walletApplyAmount,
        is_deluxe: isDeluxe,
        is_scheduled: isScheduled,
        scheduled_at: isScheduled && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      })
      .select("id")
      .single();

    if (!insertErr && data && selectedCreditId) {
      await supabase
        .from("ride_credits")
        .update({ status: "reserved", used_ride_id: data.id })
        .eq("id", selectedCreditId);
    }

    if (!insertErr && data && walletApplyAmount > 0) {
      // The actual wallet_balance deduction now happens atomically inside
      // a database trigger the moment this ride is inserted (see migration
      // 031) — it re-verifies the rider's true current balance server-side
      // rather than trusting this client-computed amount, and rejects the
      // insert outright if there isn't enough. Doing it again here would
      // double-deduct. This is just the ledger record of what happened.
      await supabase.from("wallet_transactions").insert({
        rider_id: user.id,
        ride_id: data.id,
        type: "reserved",
        amount: -walletApplyAmount,
        currency: cfg.currency,
      });
    }

    if (!insertErr && data && stops.some((s) => s.label)) {
      const { error: stopsErr } = await supabase.from("ride_stops").insert(
        stops
          .filter((s) => s.label)
          .map((s, i) => ({
            ride_id: data.id,
            sequence: i + 1,
            address: s.label,
            lat: s.lat,
            lng: s.lng,
          }))
      );
      if (stopsErr) {
        console.error("[requestRide] failed to save stops (non-fatal, ride still created):", stopsErr);
      }
    }

    setSubmitting(false);

    if (insertErr || !data) {
      setError(insertErr?.message || "Could not request a ride");
      return;
    }

    router.push(`/rider/rides/${data.id}`);
  }

  return (
    <div className="space-y-5">
      {/* Frames the full viewport edge, not just this page's content —
          fixed positioning means it stays put regardless of scroll.
          pointer-events-none so it never blocks taps on the map/inputs
          underneath. Scoped to this page only (not the whole app). */}
      <div
        className="fixed inset-0 pointer-events-none z-40"
        style={{
          boxShadow: "inset 0 0 0 3px #D97757, inset 0 0 28px 6px rgba(217, 119, 87, 0.4)",
        }}
      />

      <TripReminder role="rider" />

      <div>
        <h1 className="text-2xl font-bold">Where to?</h1>
        <p className="text-navy-400 text-sm mt-1">Set your route, then name the fare you want to pay.</p>
      </div>

      <div className="card">
        <div className="h-56 overflow-hidden rounded-t-xl2 relative">
          <RideMap
            pickup={pickup ? [pickup.lat, pickup.lng] : cfg.center}
            dropoff={dropoff ? [dropoff.lat, dropoff.lng] : null}
            stops={stops.filter((s) => s.label).map((s) => [s.lat, s.lng])}
            liveLocation={liveLocation ? [liveLocation.lat, liveLocation.lng] : null}
            followLiveLocation={!dropoff}
            routeGeometry={route?.geometry}
            showPickupMarker={!!pickup}
            editablePickup
            editableDropoff={!!dropoff}
            onPickupDrag={async (lat, lng) => {
              const label = (await reverseGeocode(lat, lng)) || pickup?.label || "";
              setPickup({ label, lat, lng });
            }}
            onDropoffDrag={async (lat, lng) => {
              const label = (await reverseGeocode(lat, lng)) || dropoff?.label || "";
              setDropoff({ label, lat, lng });
            }}
          />
          {pickup && (
            <EditableLocationBadge
              label={pickup.label}
              position="top"
              onSave={(newLabel) => setPickup({ ...pickup, label: newLabel })}
            />
          )}
          {!pickup && (locating || locationError) && (
            <div className="absolute inset-x-0 bottom-0 bg-white/95 backdrop-blur px-4 py-2.5 flex items-center justify-between gap-2 text-sm">
              {locating ? (
                <span className="flex items-center gap-2 text-navy-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Finding your location&hellip;
                </span>
              ) : (
                <>
                  <span className="flex items-center gap-2 text-navy-400">
                    <Navigation className="w-4 h-4" /> Couldn't get your location — search below, or
                  </span>
                  <button
                    type="button"
                    className="text-gold-600 font-semibold shrink-0"
                    onClick={() => retryLocationRef.current()}
                  >
                    Try again
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="p-4 space-y-3">
          <NearbyDriversBadge pickup={pickup ? { lat: pickup.lat, lng: pickup.lng } : null} />
          {pickup && (
            <p className="text-xs text-navy-400 -mt-1 mb-1">
              Can't find your exact address? Drag the pin{dropoff ? "s" : ""} on the map to the exact spot, or edit
              the text below directly — e.g. add a house number the search couldn't find.
            </p>
          )}
          <LocationSearchInput
            value={pickup?.label}
            placeholder="Pickup location"
            onSelect={(r) => setPickup(r)}
            onTextChange={(text) => pickup && setPickup({ ...pickup, label: text })}
            countryCodes={country === "OTHER" ? undefined : country.toLowerCase()}
            bias={{ lat: cfg.center[0], lng: cfg.center[1] }}
          />

          {stops.map((stop, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-navy-400 w-4 shrink-0">{i + 1}.</span>
              <div className="flex-1">
                <LocationSearchInput
                  value={stop.label}
                  placeholder={`Stop ${i + 1}`}
                  onSelect={(r) => setStops((prev) => prev.map((s, idx) => (idx === i ? r : s)))}
                  onTextChange={(text) =>
                    setStops((prev) => prev.map((s, idx) => (idx === i && s.label ? { ...s, label: text } : s)))
                  }
                  countryCodes={country === "OTHER" ? undefined : country.toLowerCase()}
                  bias={pickup ? { lat: pickup.lat, lng: pickup.lng } : { lat: cfg.center[0], lng: cfg.center[1] }}
                />
              </div>
              <button
                type="button"
                onClick={() => setStops((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-navy-400 hover:text-coral-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setStops((prev) => [...prev, { label: "", lat: 0, lng: 0 }])}
            className="text-xs text-navy-500 font-semibold flex items-center gap-1 hover:text-navy-700"
          >
            <Plus className="w-3.5 h-3.5" /> Add a stop along the way
          </button>

          <LocationSearchInput
            value={dropoff?.label}
            placeholder="Drop-off location"
            onSelect={(r) => setDropoff(r)}
            onTextChange={(text) => dropoff && setDropoff({ ...dropoff, label: text })}
            countryCodes={country === "OTHER" ? undefined : country.toLowerCase()}
            bias={pickup ? { lat: pickup.lat, lng: pickup.lng } : { lat: cfg.center[0], lng: cfg.center[1] }}
          />
        </div>
      </div>

      {routeLoading && (
        <div className="card p-5 flex items-center gap-2 text-navy-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Calculating road distance&hellip;
        </div>
      )}

      {range && route && !routeLoading && (
        <div className="card p-5">
          <p className="label mb-2">Fair range for this trip</p>
          <p className="text-sm text-navy-500 mb-4">
            {route.distanceKm.toFixed(1)} km by road{route.durationMin ? `, about ${Math.round(route.durationMin)} min` : ""}
            {route.estimated && " (estimated — routing service unavailable)"}. Most drivers accept between{" "}
            <span className="fare-figure font-semibold text-navy-700">{currencyFormat(range.low, cfg.currency)}</span> and{" "}
            <span className="fare-figure font-semibold text-navy-700">{currencyFormat(range.high, cfg.currency)}</span>.
          </p>

          {credits.length > 0 && (
            <div className="mb-4">
              <label className="label mb-2 block flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-gold-500" /> Free ride credit available
              </label>
              <div className="flex flex-wrap gap-2">
                {credits.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`btn-ghost !py-2 !px-3 text-xs ${selectedCreditId === c.id ? "!bg-gold-400 !text-navy-900 !border-gold-400" : ""}`}
                    onClick={() => setSelectedCreditId(selectedCreditId === c.id ? null : c.id)}
                  >
                    {selectedCreditId === c.id ? "Using this credit" : `Use credit (${currencyFormat(c.amount, c.currency)})`}
                  </button>
                ))}
              </div>
              {selectedCreditId && (
                <p className="text-xs text-jade-600 mt-2">This ride will be free — the driver is compensated separately.</p>
              )}
            </div>
          )}

          {walletBalance > 0 && (!walletCurrency || walletCurrency === cfg.currency) && (
            <div className="mb-4">
              <label className="label mb-2 block flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-jade-500" /> Wallet balance: {currencyFormat(walletBalance, cfg.currency)}
              </label>
              <button
                type="button"
                className={`btn-ghost w-full !py-2 !px-3 text-sm ${useWallet ? "!bg-jade-500 !text-white !border-jade-500" : ""}`}
                onClick={() => setUseWallet((v) => !v)}
              >
                {useWallet ? "Applying wallet balance to this ride" : "Apply wallet balance to reduce cash payment"}
              </button>
              {useWallet && offer && (
                <p className="text-xs text-jade-600 mt-2">
                  {currencyFormat(Math.min(walletBalance, Number(offer)), cfg.currency)} covered by wallet — you'll pay{" "}
                  {currencyFormat(Math.max(Number(offer) - walletBalance, 0), cfg.currency)} in cash.
                </p>
              )}
            </div>
          )}

          <div className="mb-4">
            <button
              type="button"
              onClick={() => setIsDeluxe((v) => !v)}
              className={`w-full text-left rounded-xl border-2 p-4 transition ${
                isDeluxe ? "border-navy-800 bg-navy-800 text-paper" : "border-navy-100 bg-white text-navy-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-display font-semibold">
                  <Sparkles className={`w-4 h-4 ${isDeluxe ? "text-gold-400" : "text-navy-400"}`} /> Vuma Deluxe
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    isDeluxe ? "bg-gold-400 text-navy-900" : "bg-navy-50 text-navy-500"
                  }`}
                >
                  {isDeluxe ? "Selected" : "Select"}
                </span>
              </div>
              <p className={`text-xs mt-1.5 ${isDeluxe ? "text-navy-300" : "text-navy-400"}`}>
                Executive, top-of-range vehicles — physically inspected and certified. Includes private security
                rapid-response if you ever need to raise an SOS. Fares run higher for this tier.
              </p>
            </button>
          </div>

          <div className="mb-4">
            <button
              type="button"
              onClick={() => setIsScheduled((v) => !v)}
              className={`w-full text-left rounded-xl border-2 p-4 transition ${
                isScheduled ? "border-navy-800 bg-navy-800 text-paper" : "border-navy-100 bg-white text-navy-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-display font-semibold">
                  <CalendarClock className={`w-4 h-4 ${isScheduled ? "text-gold-400" : "text-navy-400"}`} /> Schedule for later
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    isScheduled ? "bg-gold-400 text-navy-900" : "bg-navy-50 text-navy-500"
                  }`}
                >
                  {isScheduled ? "Selected" : "Select"}
                </span>
              </div>
              <p className={`text-xs mt-1.5 ${isScheduled ? "text-navy-300" : "text-navy-400"}`}>
                Book ahead for a fixed date and time — good for airport runs, school pickups, or any trip you don't
                want to leave to chance.
              </p>
            </button>
            {isScheduled && (
              <div className="mt-3">
                <label className="label block mb-1">Pickup date &amp; time</label>
                <input
                  type="datetime-local"
                  className="input"
                  min={minScheduleDatetimeLocal}
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
                <p className="text-xs text-navy-400 mt-1.5">Must be at least 30 minutes from now.</p>
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="label mb-2 block flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-navy-400" /> Seats needed
            </label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn-ghost !px-3 !py-2 text-sm ${seatsRequired === n ? "!bg-navy-800 !text-paper !border-navy-800" : ""}`}
                  onClick={() => setSeatsRequired(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-navy-400 mt-1.5">Only drivers with a car that fits this many will see your request.</p>
          </div>

          {weatherAdvisory && (
            <div className="mb-4 flex items-start gap-2.5 bg-navy-50 rounded-xl px-4 py-3">
              {weatherAdvisory.icon === "umbrella" && <CloudRain className="w-4 h-4 text-navy-500 mt-0.5 shrink-0" />}
              {weatherAdvisory.icon === "coat" && <Snowflake className="w-4 h-4 text-navy-500 mt-0.5 shrink-0" />}
              {weatherAdvisory.icon === "sun" && <Sun className="w-4 h-4 text-gold-500 mt-0.5 shrink-0" />}
              {weatherAdvisory.icon === "pleasant" && <Sun className="w-4 h-4 text-jade-500 mt-0.5 shrink-0" />}
              <p className="text-sm text-navy-600">{weatherAdvisory.message}</p>
            </div>
          )}

          <label className="label mb-2 block">Your offer</label>
          <div className="flex items-center gap-3">
            <span className="fare-figure text-lg text-navy-400">{cfg.currencySymbol}</span>
            <input
              type="number"
              className="input fare-figure text-lg"
              value={offer}
              min={1}
              onChange={(e) => setOffer(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>

          {error && <p className="text-sm text-coral-600 mt-3">{error}</p>}
          {stops.some((s) => !s.label) && (
            <p className="text-sm text-gold-600 mt-3">Finish selecting your stop, or remove it, before requesting.</p>
          )}
          {isScheduled && !isScheduledTimeValid && (
            <p className="text-sm text-gold-600 mt-3">Pick a pickup time at least 30 minutes from now.</p>
          )}
          {isOffline && (
            <p className="text-sm text-coral-600 mt-3">You're offline — reconnect to request a ride.</p>
          )}

          <button
            className="btn-primary w-full mt-5"
            disabled={submitting || !offer || stops.some((s) => !s.label) || isOffline || !isScheduledTimeValid}
            onClick={requestRide}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Request at {offer ? currencyFormat(Number(offer), cfg.currency) : "—"}
          </button>
        </div>
      )}

      <Link href="/vuma-private" className="block text-center text-xs text-navy-400 pt-2 pb-4">
        Going with people you know?{" "}
        <span className="text-jade-600 underline font-medium">Try Vuma Private</span> — cost-share with your own group
      </Link>
    </div>
  );
}
