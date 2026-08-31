"use client";

import { useEffect, useState, useCallback, use, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatusPill } from "@/components/ui/StatusPill";
import { currencyFormat } from "@/lib/commission";
import { getRoadRoute, haversineKm } from "@/lib/geo";
import { SosPanel } from "@/components/safety/SosPanel";
import { ContactCard } from "@/components/ride/ContactCard";
import { ScheduledCancelPanel } from "@/components/ride/ScheduledCancelPanel";
import { DownloadReceiptButton } from "@/components/ride/DownloadReceiptButton";
import type { Ride, RideStop, RoadAlert } from "@/lib/types";
import { Loader2, Play, CheckCircle2, X, Star, PartyPopper, AlertTriangle, MapPin } from "lucide-react";
import { useModal } from "@/components/ui/ModalProvider";
import { getRemainingChangeCreditRoom } from "@/lib/wallet";
import { formatDistanceToNow } from "date-fns";

const RideMap = dynamic(() => import("@/components/map/RideMap"), { ssr: false });

export default function DriverRideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <DriverRideDetailInner params={params} />
    </Suspense>
  );
}

function DriverRideDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient();
  const router = useRouter();
  const modal = useModal();
  const searchParams = useSearchParams();
  const [showAcceptedBanner, setShowAcceptedBanner] = useState(searchParams.get("justAccepted") === "1");
  const { id: rideId } = use(params);

  const [ride, setRide] = useState<Ride | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [otherActiveRideId, setOtherActiveRideId] = useState<string | null>(null);
  const [stops, setStops] = useState<RideStop[]>([]);
  const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(null);
  const [matchedAlerts, setMatchedAlerts] = useState<RoadAlert[]>([]);
  const [clearingAlertId, setClearingAlertId] = useState<string | null>(null);
  const [remainingCreditRoom, setRemainingCreditRoom] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showSafetyCheck, setShowSafetyCheck] = useState(false);
  const [safetyCheckBusy, setSafetyCheckBusy] = useState(false);
  const [completion, setCompletion] = useState<{
    fare: number;
    commissionPct: number;
    commissionAmount: number;
    driverTakeHome: number;
    commissionSource: string;
    walletApplied: number;
    cashDue: number;
    changeCreditGiven: number;
    changeCreditCapped: boolean;
    isDeluxe: boolean;
    deluxeMultiplier: number | null;
  } | null>(null);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [stars, setStars] = useState(5);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [changeAmount, setChangeAmount] = useState<number | "">("");
  const [creditingChange, setCreditingChange] = useState(false);
  const [changeCredited, setChangeCredited] = useState(false);

  const loadRide = useCallback(async () => {
    const { data } = await supabase.from("rides").select("*").eq("id", rideId).single();
    setRide(data as Ride);
    const { data: stopsData } = await supabase.from("ride_stops").select("*").eq("ride_id", rideId).order("sequence");
    setStops((stopsData as RideStop[]) || []);

    // Only relevant for a ride that's accepted but not yet started — check
    // whether this driver has a *different* ride already in progress, so
    // starting a new trip (or even seeing its full active-trip screen) can
    // be gated behind finishing the one already underway.
    if (data?.status === "accepted" && data.driver_id) {
      const { data: otherActive } = await supabase
        .from("rides")
        .select("id")
        .eq("driver_id", data.driver_id)
        .eq("status", "in_progress")
        .neq("id", rideId)
        .limit(1)
        .maybeSingle();
      setOtherActiveRideId(otherActive?.id || null);
    } else {
      setOtherActiveRideId(null);
    }

    setLoading(false);
  }, [rideId, supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
    loadRide();
    const channel = supabase
      .channel(`driver-ride-${rideId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `id=eq.${rideId}` }, () => loadRide())
      .subscribe();

    // Safety net alongside realtime — see rider ride detail page for rationale.
    const poll = setInterval(() => loadRide(), 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [rideId, loadRide, supabase]);

  useEffect(() => {
    if (!showAcceptedBanner) return;
    const t = setTimeout(() => setShowAcceptedBanner(false), 6000);
    return () => clearTimeout(t);
  }, [showAcceptedBanner]);

  useEffect(() => {
    if (!ride) return;
    getRoadRoute(
      { lat: ride.pickup_lat, lng: ride.pickup_lng },
      { lat: ride.dropoff_lat, lng: ride.dropoff_lng },
      ride.country
    ).then((r) => setRouteGeometry(r.geometry));
  }, [ride?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Surface any driver-reported road alert that falls near this ride's
  // route — checks every point along the route against every alert
  // reported today, which is trivially fast even for a long route (a few
  // hundred points) against a realistic number of same-day alerts.
  const MATCH_RADIUS_KM = 5;
  useEffect(() => {
    if (!ride || !routeGeometry || !routeGeometry.length) return;
    let cancelled = false;
    (async () => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("road_alerts")
        .select("*")
        .eq("country", ride.country)
        .gte("created_at", startOfToday.toISOString())
        .is("cleared_at", null);
      if (cancelled || !data) return;

      const matches = (data as RoadAlert[]).filter((alert) =>
        routeGeometry.some(([lat, lng]) => haversineKm(alert.lat, alert.lng, lat, lng) <= MATCH_RADIUS_KM)
      );
      setMatchedAlerts(matches);
    })();
    return () => {
      cancelled = true;
    };
  }, [ride?.country, routeGeometry, supabase]);

  useEffect(() => {
    if (!ride || !userId || ride.wallet_applied <= 0 || ride.status === "completed") return;
    getRemainingChangeCreditRoom(supabase, userId, ride.country).then(setRemainingCreditRoom);
  }, [ride?.id, ride?.wallet_applied, ride?.status, ride?.country, userId, supabase]);

  async function clearMatchedAlert(alertId: string) {
    const ok = await modal.confirm("Mark this alert as resolved? It'll stop showing to other drivers.", {
      confirmLabel: "Clear it",
    });
    if (!ok) return;
    setClearingAlertId(alertId);
    const res = await fetch(`/api/road-alerts/${alertId}/clear`, { method: "POST" });
    setClearingAlertId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not clear: ${data.error || "Unknown error"}`);
      return;
    }
    setMatchedAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }

  async function startTrip() {
    if (!ride) return;
    setBusy(true);
    // Location is already being tracked continuously by the global
    // LocationBroadcaster (mounted in the driver layout) — no separate
    // watch needed here.
    const res = await fetch(`/api/rides/${rideId}/start`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not start trip: ${data.error || "Unknown error"}`);
      return;
    }
  }

  async function completeTrip() {
    setBusy(true);
    const res = await fetch(`/api/rides/${rideId}/complete`, { method: "POST" });
    const data = await res.json();
    if (res.ok) setCompletion(data);
    setBusy(false);
  }

  // "Is everything OK?" check — fires once a trip has run to roughly 4x its
  // own estimated duration, a generous multiplier meant to catch genuinely
  // anomalous situations (breakdown, detour, distress) rather than normal
  // traffic variance. Checked client-side on an interval rather than a
  // server-side scheduled job, matching this app's established pattern
  // elsewhere of no reliable cron on this hosting tier — but the trigger
  // itself is persisted to the database the moment it fires, not just held
  // in local state, so it survives a page reload and won't fire twice.
  useEffect(() => {
    if (!ride || ride.status !== "in_progress" || ride.safety_check_status !== "none") return;
    if (!ride.started_at || !ride.estimated_duration_min) return;

    function checkOverdue() {
      const elapsedMin = (Date.now() - new Date(ride!.started_at!).getTime()) / 60000;
      if (elapsedMin >= ride!.estimated_duration_min! * 4) {
        setShowSafetyCheck(true);
        supabase.from("rides").update({ safety_check_status: "triggered", safety_check_triggered_at: new Date().toISOString() }).eq("id", rideId).then();
      }
    }

    checkOverdue();
    const interval = setInterval(checkOverdue, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.status, ride?.safety_check_status, ride?.started_at, ride?.estimated_duration_min]);

  async function respondSafetyCheckCompleted() {
    setSafetyCheckBusy(true);
    await supabase.from("rides").update({ safety_check_status: "responded" }).eq("id", rideId);
    setShowSafetyCheck(false);
    await completeTrip();
    setSafetyCheckBusy(false);
  }

  async function respondSafetyCheckSOS() {
    setSafetyCheckBusy(true);
    await supabase.from("rides").update({ safety_check_status: "responded" }).eq("id", rideId);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        await fetch("/api/sos/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rideId, lat: pos.coords.latitude, lng: pos.coords.longitude }),
        });
        setSafetyCheckBusy(false);
        setShowSafetyCheck(false);
      });
    } else {
      setSafetyCheckBusy(false);
    }
  }

  async function creditChange() {
    if (!changeAmount || Number(changeAmount) <= 0) return;
    setCreditingChange(true);
    const res = await fetch("/api/wallet/credit-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rideId, amount: changeAmount }),
    });
    const data = await res.json();
    setCreditingChange(false);
    if (!res.ok) {
      await modal.alert(`Could not credit change: ${data.error}`);
      return;
    }
    setChangeCredited(true);
    setShowChangeForm(false);
  }

  async function cancelTrip() {
    setBusy(true);
    await fetch(`/api/rides/${rideId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Driver cancelled" }),
    });
    setBusy(false);
  }

  async function submitRating() {
    if (!ride) return;
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("ratings").insert({ ride_id: rideId, from_user_id: user.id, to_user_id: ride.rider_id, stars });
      setRatingSubmitted(true);
    }
    setBusy(false);
  }

  if (loading || !ride) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading trip&hellip;
      </div>
    );
  }

  // A driver can only have one active immediate trip at a time. If this
  // ride was just accepted while another is still in progress, this screen
  // stays gated — no map, no fare, no Start button — until the current
  // trip is completed. Scheduled rides are exempt: they're for a future
  // time regardless, so there's no real conflict in viewing or preparing
  // for one while another trip is currently underway — the driver simply
  // won't be able to start it until its own scheduled time, by which point
  // the current trip should be long finished anyway.
  if (ride.status === "accepted" && !ride.is_scheduled && otherActiveRideId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <Loader2 className="w-8 h-8 text-gold-500" />
        <div>
          <p className="font-semibold text-navy-700">You have a trip already in progress</p>
          <p className="text-sm text-navy-400 mt-1 max-w-xs">
            Finish that trip first — this one will be ready for you as soon as you do.
          </p>
        </div>
        <Link href={`/driver/rides/${otherActiveRideId}`} className="btn-primary">
          Go to active trip
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {showAcceptedBanner && (
        <div className="card p-5 bg-jade-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PartyPopper className="w-6 h-6" />
            <div>
              <p className="font-display font-bold text-lg">{ride.is_scheduled ? "Accepted!" : "Accepted — let's go!"}</p>
              <p className="text-jade-50 text-sm">
                {ride.is_scheduled
                  ? "Set a reminder for this appointment — you'll see it on your dashboard as it gets close."
                  : "Head to the pickup point when you're ready."}
              </p>
            </div>
          </div>
          <button onClick={() => setShowAcceptedBanner(false)} className="text-jade-100 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Trip to {ride.dropoff_address.split(",")[0]}</h1>
        <StatusPill status={ride.status} />
      </div>

      {(() => {
        const riderSharingLive =
          ride.rider_live_location_active &&
          ride.rider_live_location_lat &&
          ride.rider_live_location_lng &&
          ride.rider_live_location_updated_at &&
          Date.now() - new Date(ride.rider_live_location_updated_at).getTime() < 3 * 60_000;
        return (
          <>
            <div className="card overflow-hidden h-56">
              <RideMap
                pickup={[ride.pickup_lat, ride.pickup_lng]}
                dropoff={[ride.dropoff_lat, ride.dropoff_lng]}
                stops={stops.map((s) => [s.lat, s.lng])}
                routeGeometry={routeGeometry}
                riderLocation={riderSharingLive ? [ride.rider_live_location_lat!, ride.rider_live_location_lng!] : null}
              />
            </div>
            {riderSharingLive && (
              <p className="text-xs text-jade-600 font-semibold text-center -mt-3">Rider is sharing their live location</p>
            )}
          </>
        );
      })()}

      <div className="card p-5">
        <p className="label mb-1">Agreed fare</p>
        <p className="fare-figure text-2xl font-bold">{currencyFormat(Number(ride.final_fare ?? ride.rider_offer), ride.currency)}</p>
        <p className="text-sm text-navy-400 mt-2">Pickup: {ride.pickup_address}</p>
        {stops.map((s, i) => (
          <p key={s.id} className="text-sm text-navy-400">
            Stop {i + 1}: {s.address}
          </p>
        ))}
        <p className="text-sm text-navy-400">Drop-off: {ride.dropoff_address}</p>
        {stops.length > 0 && (
          <p className="text-xs text-gold-600 font-semibold mt-1">This trip has {stops.length} stop{stops.length > 1 ? "s" : ""} — not a direct route.</p>
        )}
      </div>

      {ride.wallet_applied > 0 && ride.status !== "completed" && (
        <div
          className={`card p-4 ${
            remainingCreditRoom !== null && ride.wallet_applied > remainingCreditRoom
              ? "bg-coral-500/5 border-coral-500/20"
              : "bg-jade-50 border-jade-200"
          }`}
        >
          <p className="text-sm font-semibold text-navy-700">
            {currencyFormat(ride.wallet_applied, ride.currency)} of this fare is rider wallet credit
          </p>
          <p className="text-xs text-navy-500 mt-1">
            You'll collect {currencyFormat(Math.max(Number(ride.final_fare ?? ride.rider_offer) - ride.wallet_applied, 0), ride.currency)}{" "}
            in cash. The rest is compensated as spendable credit (subscription or priority boost only, not cash).
          </p>
          {remainingCreditRoom !== null && ride.wallet_applied > remainingCreditRoom && (
            <p className="text-xs font-semibold text-coral-700 mt-2">
              You're near your monthly redemption limit — you'd only be compensated{" "}
              {currencyFormat(remainingCreditRoom, ride.currency)} of that {currencyFormat(ride.wallet_applied, ride.currency)}, not
              the full amount.
            </p>
          )}
        </div>
      )}

      {matchedAlerts.length > 0 && (
        <div className="card p-4 bg-gold-50 border-gold-200 space-y-3">
          <p className="label !text-gold-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Road alert{matchedAlerts.length > 1 ? "s" : ""} along your route
          </p>
          {matchedAlerts.map((a) => (
            <div key={a.id}>
              <p className="text-sm font-semibold text-navy-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-navy-400" /> {a.road_name}
              </p>
              <p className="text-sm text-navy-600">{a.message}</p>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-xs text-navy-400">
                  Reported {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                </p>
                <button
                  className="text-xs font-semibold text-jade-600 flex items-center gap-1"
                  disabled={clearingAlertId === a.id}
                  onClick={() => clearMatchedAlert(a.id)}
                >
                  {clearingAlertId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  It's clear now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(() => {
        const within24hOfCompletion =
          ride.status === "completed" && ride.completed_at && Date.now() - new Date(ride.completed_at).getTime() < 24 * 60 * 60 * 1000;
        const showContact = ride.status === "accepted" || ride.status === "in_progress" || within24hOfCompletion;
        if (!showContact) return null;
        return (
          <div className="space-y-2">
            {within24hOfCompletion && (
              <p className="text-xs text-navy-400 text-center">Left something in the car? You can still reach the rider.</p>
            )}
            <ContactCard rideId={ride.id} otherUserId={ride.rider_id} otherRoleLabel="rider" canCall={true} />
          </div>
        );
      })()}

      {(ride.status === "accepted" || ride.status === "in_progress") && (
        <SosPanel rideId={ride.id} country={ride.country} isDeluxe={ride.is_deluxe} />
      )}

      {ride.status === "accepted" && ride.is_scheduled ? (
        <div className="space-y-3">
          {userId && <ScheduledCancelPanel ride={ride} currentUserId={userId} isDriver={true} onUpdate={loadRide} />}
          <button className="btn-primary w-full" onClick={startTrip} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Start trip
          </button>
        </div>
      ) : (
        ride.status === "accepted" && (
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-ghost text-coral-600" onClick={cancelTrip} disabled={busy}>
              <X className="w-4 h-4" /> Cancel
            </button>
            <button className="btn-primary" onClick={startTrip} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Start trip
            </button>
          </div>
        )
      )}

      {ride.status === "in_progress" && !completion && (
        <button className="btn-primary w-full" onClick={completeTrip} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Complete trip
        </button>
      )}

      {completion && (
        <div className="card p-5 space-y-3">
          <p className="label">Trip summary</p>
          <div className="flex justify-between text-sm">
            <span className="text-navy-400">Fare</span>
            <span className="fare-figure">{currencyFormat(completion.fare, ride.currency)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-navy-400">
              Commission ({completion.commissionPct}%
              {completion.commissionSource === "subscription" && " — subscription rate"}
              {completion.commissionSource === "referral_credit" && " — rider used a referral credit"}
              {completion.commissionSource === "reward_credit" && " — reward credit applied"}
              {completion.isDeluxe && ` — Vuma Deluxe rate (${completion.deluxeMultiplier}×)`})
            </span>
            <span className="fare-figure text-coral-600">-{currencyFormat(completion.commissionAmount, ride.currency)}</span>
          </div>
          {completion.commissionSource === "referral_credit" && (
            <p className="text-xs text-jade-600 -mt-1">
              You&rsquo;ve been given priority ranking as thanks for honoring this credit.
            </p>
          )}
          {completion.walletApplied > 0 && (
            <div className="flex justify-between text-sm bg-jade-50 -mx-5 px-5 py-2">
              <span className="text-jade-700">Cash to collect from rider</span>
              <span className="fare-figure font-semibold text-jade-700">{currencyFormat(completion.cashDue, ride.currency)}</span>
            </div>
          )}
          {completion.changeCreditGiven > 0 && (
            <div className="bg-gold-50 -mx-5 px-5 py-2 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gold-700">+ Credit earned</span>
                <span className="fare-figure font-semibold text-gold-700">
                  {currencyFormat(completion.changeCreditGiven, ride.currency)}
                </span>
              </div>
              <p className="text-xs text-gold-600">
                Redeemable toward your subscription or a priority boost only — not cash. See Earnings.
              </p>
              {completion.changeCreditCapped && (
                <p className="text-xs text-coral-600">
                  You've hit your monthly limit for change-credit redemption — this was less than the full amount.
                </p>
              )}
            </div>
          )}
          <div className="flex justify-between font-semibold border-t border-navy-100 pt-3">
            <span>You keep</span>
            <span className="fare-figure text-jade-600">{currencyFormat(completion.driverTakeHome, ride.currency)}</span>
          </div>

          {!changeCredited ? (
            !showChangeForm ? (
              <button className="btn-ghost w-full !py-2 text-sm" onClick={() => setShowChangeForm(true)}>
                No change? Credit rider's wallet instead
              </button>
            ) : (
              <div className="space-y-2 pt-1">
                <input
                  type="number"
                  className="input"
                  placeholder={`Amount to credit (${ride.currency})`}
                  value={changeAmount}
                  onChange={(e) => setChangeAmount(e.target.value === "" ? "" : Number(e.target.value))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-ghost" onClick={() => setShowChangeForm(false)} disabled={creditingChange}>
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={creditChange} disabled={creditingChange || !changeAmount}>
                    {creditingChange && <Loader2 className="w-4 h-4 animate-spin" />} Credit rider
                  </button>
                </div>
              </div>
            )
          ) : (
            <p className="text-xs text-jade-600 text-center">Rider's wallet credited successfully.</p>
          )}

          {!ratingSubmitted ? (
            <div className="pt-2">
              <p className="label mb-2">Rate your rider</p>
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setStars(s)}>
                    <Star className={`w-6 h-6 ${s <= stars ? "fill-gold-400 text-gold-400" : "text-navy-200"}`} />
                  </button>
                ))}
              </div>
              <button className="btn-primary w-full" onClick={submitRating} disabled={busy}>
                Submit rating
              </button>
            </div>
          ) : (
            <button className="btn-dark w-full" onClick={() => router.push("/driver")}>
              Back to requests
            </button>
          )}
          <DownloadReceiptButton ride={ride} />
        </div>
      )}

      {ride.status === "completed" && !completion && (
        <div className="card p-5 text-center space-y-4">
          <p className="text-navy-500">Trip already completed.</p>
          <p className="fare-figure text-2xl font-bold">{currencyFormat(Number(ride.final_fare ?? ride.rider_offer), ride.currency)}</p>
          {!ratingSubmitted ? (
            <>
              <div className="flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setStars(s)}>
                    <Star className={`w-6 h-6 ${s <= stars ? "fill-gold-400 text-gold-400" : "text-navy-200"}`} />
                  </button>
                ))}
              </div>
              <button className="btn-primary w-full" onClick={submitRating} disabled={busy}>
                Rate rider
              </button>
            </>
          ) : (
            <p className="text-jade-600 font-medium">Rating submitted.</p>
          )}

          {!changeCredited ? (
            !showChangeForm ? (
              <button className="btn-ghost w-full !py-2 text-sm" onClick={() => setShowChangeForm(true)}>
                No change? Credit rider's wallet instead
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="number"
                  className="input"
                  placeholder={`Amount to credit (${ride.currency})`}
                  value={changeAmount}
                  onChange={(e) => setChangeAmount(e.target.value === "" ? "" : Number(e.target.value))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-ghost" onClick={() => setShowChangeForm(false)} disabled={creditingChange}>
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={creditChange} disabled={creditingChange || !changeAmount}>
                    {creditingChange && <Loader2 className="w-4 h-4 animate-spin" />} Credit rider
                  </button>
                </div>
              </div>
            )
          ) : (
            <p className="text-xs text-jade-600">Rider's wallet credited successfully.</p>
          )}

          <DownloadReceiptButton ride={ride} />
          <button className="btn-dark w-full" onClick={() => router.push("/driver")}>
            Back to requests
          </button>
        </div>
      )}

      {ride.status === "cancelled" && (
        <div className="card p-5 text-center">
          <p className="text-navy-500">This trip was cancelled.</p>
          <button className="btn-dark w-full mt-4" onClick={() => router.push("/driver")}>
            Back to requests
          </button>
        </div>
      )}

      {showSafetyCheck && (
        <div className="fixed inset-0 bg-navy-900/60 flex items-center justify-center z-50 px-5">
          <div className="card p-6 max-w-sm text-center">
            <AlertTriangle className="w-8 h-8 text-gold-500 mx-auto mb-3" />
            <p className="font-bold text-navy-800 mb-1">Is everything OK?</p>
            <p className="text-sm text-navy-500 mb-5">
              This trip has taken much longer than expected. Let us know what's happening.
            </p>
            <div className="space-y-2">
              <button className="btn-primary w-full" disabled={safetyCheckBusy} onClick={respondSafetyCheckCompleted}>
                {safetyCheckBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "I'm safe — mark ride completed"}
              </button>
              <button className="btn-danger w-full" disabled={safetyCheckBusy} onClick={respondSafetyCheckSOS}>
                {safetyCheckBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "SOS — I need help"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
