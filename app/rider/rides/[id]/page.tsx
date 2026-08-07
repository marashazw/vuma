"use client";

import { useEffect, useState, useCallback, use } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { expireStaleOffers } from "@/lib/offers";
import { NegotiationTracker } from "@/components/rider/NegotiationTracker";
import { StatusPill } from "@/components/ui/StatusPill";
import { currencyFormat } from "@/lib/commission";
import { getRoadRoute } from "@/lib/geo";
import { COUNTRIES } from "@/lib/constants";
import { SosPanel } from "@/components/safety/SosPanel";
import { ContactCard } from "@/components/ride/ContactCard";
import { ScheduledCancelPanel } from "@/components/ride/ScheduledCancelPanel";
import { ShareRideButton } from "@/components/ride/ShareRideButton";
import { DownloadReceiptButton } from "@/components/ride/DownloadReceiptButton";
import { DriverRatingForm } from "@/components/rider/DriverRatingForm";
import type { Ride, RideOffer, DriverProfile, Profile, RideStop } from "@/lib/types";
import { getWeatherAdvisory, type WeatherAdvisory } from "@/lib/weather";
import { Loader2, X, Navigation, CloudRain, Snowflake, Sun, CalendarClock } from "lucide-react";
import { useModal } from "@/components/ui/ModalProvider";

const RideMap = dynamic(() => import("@/components/map/RideMap"), { ssr: false });

export default function RiderRideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient();
  const router = useRouter();
  const modal = useModal();
  const { id: rideId } = use(params);

  const [ride, setRide] = useState<Ride | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [weatherAdvisory, setWeatherAdvisory] = useState<WeatherAdvisory | null>(null);
  const [stops, setStops] = useState<RideStop[]>([]);
  const [offers, setOffers] = useState<RideOffer[]>([]);
  const [priorityDriverIds, setPriorityDriverIds] = useState<Set<string>>(new Set());
  const [offerVehicleInfo, setOfferVehicleInfo] = useState<
    Record<
      string,
      { make: string | null; model: string | null; color: string | null; seats: number | null; plate: string | null; etaMin: number | null }
    >
  >({});
  const [driver, setDriver] = useState<(DriverProfile & { profile?: Profile }) | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(null);
  const [approachRoute, setApproachRoute] = useState<{ geometry: [number, number][]; etaMin: number; distanceKm: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [stars, setStars] = useState(5);
  const [tagPoliteness, setTagPoliteness] = useState<"polite" | "rude" | null>(null);
  const [tagPunctuality, setTagPunctuality] = useState<"on_time" | "very_late" | null>(null);
  const [tagCleanliness, setTagCleanliness] = useState<"clean" | "dirty" | null>(null);
  const [showOtherComment, setShowOtherComment] = useState(false);
  const [otherComment, setOtherComment] = useState("");

  const loadRide = useCallback(async () => {
    const { data } = await supabase.from("rides").select("*").eq("id", rideId).single();
    setRide(data as Ride);
    const { data: stopsData } = await supabase.from("ride_stops").select("*").eq("ride_id", rideId).order("sequence");
    setStops((stopsData as RideStop[]) || []);
    setLoading(false);
  }, [rideId, supabase]);

  const loadOffers = useCallback(async () => {
    await expireStaleOffers(supabase, { rideId });

    const { data } = await supabase
      .from("ride_offers")
      .select("*")
      .eq("ride_id", rideId)
      .in("status", ["pending", "countered"])
      .order("amount", { ascending: true });

    const offersList = (data as RideOffer[]) || [];
    const driverIds = [...new Set(offersList.map((o) => o.driver_id))];
    if (driverIds.length) {
      const { data: driverProfiles } = await supabase
        .from("driver_profiles")
        .select("user_id, priority_until, vehicle_make, vehicle_model, vehicle_color, vehicle_seats, plate_number, current_lat, current_lng")
        .in("user_id", driverIds);
      const now = Date.now();
      const priority = new Set(
        (driverProfiles || [])
          .filter((d) => d.priority_until && new Date(d.priority_until).getTime() > now)
          .map((d) => d.user_id)
      );
      setPriorityDriverIds(priority);

      setOfferVehicleInfo((prev) => {
        const vehicleInfo: typeof offerVehicleInfo = {};
        (driverProfiles || []).forEach((d) => {
          vehicleInfo[d.user_id] = {
            make: d.vehicle_make,
            model: d.vehicle_model,
            color: d.vehicle_color,
            seats: d.vehicle_seats,
            plate: d.plate_number,
            // Keep whatever ETA we already had for this driver rather than
            // blanking it out — it gets refreshed in the background below
            // regardless, but the displayed value now stays stable across
            // refreshes instead of flickering blank-then-refilled on every
            // poll cycle. Reading `prev` here (not the outer closure) is
            // deliberate — this callback isn't recreated on every
            // offerVehicleInfo change, so the outer variable would be stale.
            etaMin: prev[d.user_id]?.etaMin ?? null,
          };
        });
        return vehicleInfo;
      });

      // Compute each bidding driver's ETA to pickup in parallel — this is a
      // "nice to have" estimate to help the rider decide, so failures here
      // are silently ignored rather than blocking the offers list.
      if (ride) {
        const withLocation = (driverProfiles || []).filter((d) => d.current_lat && d.current_lng);
        Promise.all(
          withLocation.map(async (d) => {
            try {
              const r = await getRoadRoute(
                { lat: d.current_lat!, lng: d.current_lng! },
                { lat: ride.pickup_lat, lng: ride.pickup_lng },
                ride.country
              );
              return { driverId: d.user_id, etaMin: r.durationMin };
            } catch {
              return null;
            }
          })
        ).then((results) => {
          setOfferVehicleInfo((prev) => {
            const next = { ...prev };
            results.forEach((res) => {
              if (res && next[res.driverId]) next[res.driverId] = { ...next[res.driverId], etaMin: res.etaMin };
            });
            return next;
          });
        });
      }

      offersList.sort((a, b) => {
        const aP = priority.has(a.driver_id) ? 0 : 1;
        const bP = priority.has(b.driver_id) ? 0 : 1;
        if (aP !== bP) return aP - bP;
        return a.amount - b.amount;
      });
    }
    setOffers(offersList);
  }, [rideId, supabase, ride]);

  // Same weather advisory as the request screen, but shown here too since
  // this is the page a rider actually spends time on while waiting for a
  // driver — the request screen is passed through quickly, easy to miss.
  useEffect(() => {
    if (!ride) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/weather?lat=${ride.dropoff_lat}&lng=${ride.dropoff_lng}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setWeatherAdvisory(getWeatherAdvisory(data.tempC, data.precipitationMm, data.weatherCode, ride.dropoff_address));
      } catch {
        // Nice-to-have only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ride?.id, ride?.dropoff_lat, ride?.dropoff_lng, ride?.dropoff_address]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
    loadRide();
    loadOffers();

    const channel = supabase
      .channel(`ride-${rideId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `id=eq.${rideId}` }, () => loadRide())
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_offers", filter: `ride_id=eq.${rideId}` }, () => loadOffers())
      .subscribe();

    // Realtime should cover this, but poll as a safety net in case a
    // realtime event is ever missed (dropped connection, publication not
    // enabled, etc.) — cheap, and only runs while this page is open.
    const poll = setInterval(() => {
      loadRide();
      loadOffers();
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [rideId, loadRide, loadOffers, supabase]);

  useEffect(() => {
    if (!ride?.driver_id) return;
    (async () => {
      const { data } = await supabase.from("driver_profiles").select("*").eq("user_id", ride.driver_id).single();
      setDriver(data as DriverProfile);
    })();

    const channel = supabase
      .channel(`driver-loc-${ride.driver_id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "driver_profiles", filter: `user_id=eq.${ride.driver_id}` },
        (payload) => setDriver(payload.new as DriverProfile)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ride?.driver_id, supabase]);

  useEffect(() => {
    if (!ride) return;
    getRoadRoute(
      { lat: ride.pickup_lat, lng: ride.pickup_lng },
      { lat: ride.dropoff_lat, lng: ride.dropoff_lng },
      ride.country
    ).then((r) => setRouteGeometry(r.geometry));
  }, [ride?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ride || ride.status !== "accepted") {
      setApproachRoute(null);
      return;
    }
    if (!driver?.current_lat || !driver?.current_lng) return;

    let cancelled = false;
    getRoadRoute(
      { lat: driver.current_lat, lng: driver.current_lng },
      { lat: ride.pickup_lat, lng: ride.pickup_lng },
      ride.country
    ).then((r) => {
      if (!cancelled) setApproachRoute({ geometry: r.geometry, etaMin: r.durationMin, distanceKm: r.distanceKm });
    });
    return () => {
      cancelled = true;
    };
    // Recompute roughly every time a new driver location comes in, which is
    // already throttled by the GPS update rate + maximumAge on the watch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.status, driver?.current_lat, driver?.current_lng]);

  async function acceptOffer(offer: RideOffer) {
    setBusy(true);
    const res = await fetch(`/api/rides/${rideId}/accept-offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId: offer.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("[acceptOffer] failed:", data.error, data.debug);
      const debugText = data.debug ? ` (you: ${data.debug.sessionUserId}, ride's rider: ${data.debug.rideRiderId})` : "";
      await modal.alert(`Could not accept offer: ${data.error || "Unknown error"}${debugText}`);
      setBusy(false);
      return;
    }

    // Don't wait on realtime for our own change — refresh immediately.
    await loadRide();
    setBusy(false);
  }

  async function adjustOffer(newAmount: number) {
    if (!Number.isFinite(newAmount)) {
      console.error("[adjustOffer] refusing to submit a non-finite amount:", newAmount);
      return;
    }
    const floor = 1;
    const clamped = Math.max(Math.round(newAmount * 100) / 100, floor);
    setBusy(true);

    try {
      // Mobile connections occasionally drop a single request even when
      // otherwise fine — retry a couple of times before bothering the
      // user, but only for genuine network-level failures, never for a
      // real permission/data error, which would just fail identically
      // every time.
      //
      // Also request the row back with .select() and explicitly check
      // it's non-empty: PostgREST treats an update silently blocked by
      // RLS (0 rows matched) as a *success* with no error, not a
      // failure — without this check, a permissions problem would look
      // exactly like nothing happened at all, with no error shown.
      let lastError: { message: string } | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
        const { data, error } = await supabase
          .from("rides")
          .update({ rider_offer: clamped, status: "negotiating" })
          .eq("id", rideId)
          .select();
        if (!error && data && data.length > 0) {
          lastError = null;
          break;
        }
        lastError = error || {
          message: "The update didn't apply — you may not have permission to modify this ride anymore.",
        };
        const isNetworkFailure = !!error && /fetch|network/i.test(error.message);
        if (!isNetworkFailure) break;
      }

      if (lastError) {
        console.error("[adjustOffer] update failed after retries:", lastError);
        await modal.alert(`Couldn't update your offer: ${lastError.message}`);
        return;
      }
      await loadRide();
    } catch (err: any) {
      console.error("[adjustOffer] unexpected exception:", err);
      await modal.alert(`Something went wrong adjusting your offer: ${err?.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  async function cancelRide() {
    setBusy(true);
    await fetch(`/api/rides/${rideId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Rider cancelled" }),
    });
    setBusy(false);
  }

  async function submitRating() {
    if (!ride?.driver_id) return;
    setBusy(true);
    const res = await fetch("/api/ratings/submit-driver-rating", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rideId,
        stars,
        tagPoliteness,
        tagPunctuality,
        tagCleanliness,
        comment: otherComment || null,
      }),
    });
    if (res.ok) {
      setRatingSubmitted(true);
    } else {
      const data = await res.json();
      await modal.alert(`Could not submit rating: ${data.error}`);
    }
    setBusy(false);
  }

  if (loading || !ride) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading ride&hellip;
      </div>
    );
  }

  const bestOffer = offers[0] || null;
  const fareSteps = COUNTRIES[ride.country].fareSteps;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Trip to {ride.dropoff_address.split(",")[0]}</h1>
        <StatusPill status={ride.status} />
      </div>

      {weatherAdvisory && (
        <div className="flex items-start gap-2.5 bg-navy-50 rounded-xl px-4 py-3">
          {weatherAdvisory.icon === "umbrella" && <CloudRain className="w-4 h-4 text-navy-500 mt-0.5 shrink-0" />}
          {weatherAdvisory.icon === "coat" && <Snowflake className="w-4 h-4 text-navy-500 mt-0.5 shrink-0" />}
          {weatherAdvisory.icon === "sun" && <Sun className="w-4 h-4 text-gold-500 mt-0.5 shrink-0" />}
          {weatherAdvisory.icon === "pleasant" && <Sun className="w-4 h-4 text-jade-500 mt-0.5 shrink-0" />}
          <p className="text-sm text-navy-600">{weatherAdvisory.message}</p>
        </div>
      )}

      <div className="card overflow-hidden h-56">
        <RideMap
          pickup={[ride.pickup_lat, ride.pickup_lng]}
          dropoff={[ride.dropoff_lat, ride.dropoff_lng]}
          stops={stops.map((s) => [s.lat, s.lng])}
          driverLocation={driver?.current_lat && driver?.current_lng ? [driver.current_lat, driver.current_lng] : null}
          routeGeometry={ride.status === "accepted" && approachRoute ? approachRoute.geometry : routeGeometry}
        />
      </div>

      <div className="card p-4 space-y-1.5 text-sm">
        <p className="flex items-start gap-2">
          <span className="w-2 h-2 rounded-full bg-jade-500 mt-1.5 shrink-0" />
          <span className="text-navy-700">{ride.pickup_address}</span>
        </p>
        {stops.map((s, i) => (
          <p key={s.id} className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-full bg-navy-500 mt-1.5 shrink-0" />
            <span className="text-navy-500">
              Stop {i + 1}: {s.address}
            </span>
          </p>
        ))}
        <p className="flex items-start gap-2">
          <span className="w-2 h-2 rounded-full bg-coral-500 mt-1.5 shrink-0" />
          <span className="text-navy-700">{ride.dropoff_address}</span>
        </p>
      </div>

      {(ride.status === "requested" || ride.status === "negotiating") && (
        <>
          <NegotiationTracker
            riderOffer={ride.rider_offer}
            driverOffer={bestOffer?.amount ?? null}
            currency={ride.currency}
            matched={false}
          />

          {offers.length > 0 && (
            <div className="card p-5">
              <p className="label mb-1">Driver offers ({offers.length})</p>
              <p className="text-xs text-navy-400 mb-3">Offers auto-expire after 1 hour if not accepted.</p>
              <ul className="space-y-2">
                {offers.map((o) => {
                  const vehicle = offerVehicleInfo[o.driver_id];
                  const vehicleLabel = vehicle
                    ? [vehicle.color, vehicle.make, vehicle.model].filter(Boolean).join(" ")
                    : null;
                  return (
                    <li key={o.id} className="border border-navy-100 rounded-xl px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="fare-figure font-semibold">{currencyFormat(o.amount, ride.currency)}</span>
                          {priorityDriverIds.has(o.driver_id) && <span className="pill bg-gold-50 text-gold-600">Priority</span>}
                        </span>
                        <button className="btn-primary !py-2 !px-4 text-sm" disabled={busy} onClick={() => acceptOffer(o)}>
                          Accept
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-500">
                        {vehicleLabel && <span>{vehicleLabel}</span>}
                        {vehicle?.seats && <span>{vehicle.seats}-seater</span>}
                        {vehicle?.plate && (
                          <span className="font-mono font-semibold bg-navy-50 px-2 py-0.5 rounded">{vehicle.plate}</span>
                        )}
                        {vehicle?.etaMin != null && (
                          <span className="text-jade-600 font-semibold">~{Math.max(Math.round(vehicle.etaMin), 1)} min away</span>
                        )}
                        {!vehicleLabel && !vehicle?.plate && <span className="text-navy-300">Vehicle details not on file</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="label">Adjust your offer</p>
              <span className="fare-figure text-sm text-navy-400">
                Currently {currencyFormat(ride.rider_offer, ride.currency)}
              </span>
            </div>

            {bestOffer && bestOffer.amount > ride.rider_offer && (
              <button
                className="btn-dark w-full mb-3"
                disabled={busy}
                onClick={() => adjustOffer((Number(ride.rider_offer) + Number(bestOffer.amount)) / 2)}
              >
                Meet halfway at {currencyFormat((Number(ride.rider_offer) + Number(bestOffer.amount)) / 2, ride.currency)}
              </button>
            )}

            <div className="space-y-3">
              <div>
                <p className="text-xs text-navy-400 mb-2">Lower</p>
                <div className="flex flex-wrap gap-2">
                  {fareSteps.map((step) => (
                    <button
                      key={`down-${step}`}
                      className="btn-ghost flex-1 min-w-[88px] !px-2 text-sm"
                      disabled={busy}
                      onClick={() => adjustOffer(Number(ride.rider_offer) - step)}
                    >
                      -{currencyFormat(step, ride.currency)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-navy-400 mb-2">Raise</p>
                <div className="flex flex-wrap gap-2">
                  {fareSteps.map((step) => (
                    <button
                      key={`up-${step}`}
                      className="btn-ghost flex-1 min-w-[88px] !px-2 text-sm"
                      disabled={busy}
                      onClick={() => adjustOffer(Number(ride.rider_offer) + step)}
                    >
                      +{currencyFormat(step, ride.currency)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button className="btn-ghost w-full text-coral-600" onClick={cancelRide} disabled={busy}>
            <X className="w-4 h-4" /> Cancel request
          </button>
        </>
      )}

      {ride.status === "accepted" && (
        <div className="card p-5 text-center">
          <p className="text-navy-500">Your driver is on the way. Fare agreed at</p>
          <p className="fare-figure text-2xl font-bold mt-1">{currencyFormat(Number(ride.final_fare), ride.currency)}</p>
          {ride.wallet_applied > 0 && (
            <p className="text-xs text-jade-600 mt-1">
              {currencyFormat(ride.wallet_applied, ride.currency)} from your wallet — pay{" "}
              {currencyFormat(Math.max(Number(ride.final_fare) - ride.wallet_applied, 0), ride.currency)} cash
            </p>
          )}

          {(() => {
            const scheduledTime = ride.is_scheduled && ride.scheduled_at ? new Date(ride.scheduled_at).getTime() : null;
            // Once genuinely close to the scheduled time, the driver could
            // plausibly be en route — the normal arriving countdown becomes
            // accurate again. Well before that, "arriving in X min" would
            // be misleading, since the driver isn't actually heading there
            // yet for an appointment hours or days away.
            const isImminent = !scheduledTime || scheduledTime - Date.now() <= 45 * 60 * 1000;

            if (ride.is_scheduled && !isImminent) {
              return (
                <div className="mt-4 flex items-center justify-center gap-2 text-navy-600 font-semibold">
                  <CalendarClock className="w-4 h-4" />
                  Driver confirmed for{" "}
                  {new Date(ride.scheduled_at!).toLocaleString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              );
            }
            return approachRoute ? (
              <div className="mt-4 flex items-center justify-center gap-2 text-jade-600 font-semibold">
                <Navigation className="w-4 h-4" />
                Arriving in ~{Math.max(Math.round(approachRoute.etaMin), 1)} min ({approachRoute.distanceKm.toFixed(1)} km away)
              </div>
            ) : (
              <p className="text-xs text-navy-400 mt-4">Waiting for your driver's location&hellip;</p>
            );
          })()}

          {ride?.is_scheduled ? (
            userId && (
              <div className="mt-5">
                <ScheduledCancelPanel ride={ride} currentUserId={userId} isDriver={false} onUpdate={loadRide} />
              </div>
            )
          ) : (
            <button className="btn-ghost w-full mt-5 text-coral-600" onClick={cancelRide} disabled={busy}>
              Cancel trip
            </button>
          )}
        </div>
      )}

      {(ride.status === "accepted" || ride.status === "in_progress") && ride.driver_id && (
        <ContactCard rideId={ride.id} otherUserId={ride.driver_id} otherRoleLabel="driver" />
      )}

      {(ride.status === "accepted" || ride.status === "in_progress") && (
        <ShareRideButton ride={ride} driver={driver} />
      )}

      {(ride.status === "accepted" || ride.status === "in_progress") && (
        <SosPanel rideId={ride.id} country={ride.country} isDeluxe={ride.is_deluxe} />
      )}

      {ride.status === "in_progress" && (
        <div className="card p-5 text-center">
          <p className="text-navy-500">Trip in progress</p>
          <p className="fare-figure text-2xl font-bold mt-1">{currencyFormat(Number(ride.final_fare), ride.currency)}</p>
          {ride.wallet_applied > 0 && (
            <p className="text-xs text-jade-600 mt-1">
              {currencyFormat(ride.wallet_applied, ride.currency)} from your wallet — pay{" "}
              {currencyFormat(Math.max(Number(ride.final_fare) - ride.wallet_applied, 0), ride.currency)} cash
            </p>
          )}
        </div>
      )}

      {ride.status === "completed" && (
        <div className="card p-5 text-center space-y-4">
          {ride.applied_credit_id ? (
            <>
              <p className="text-jade-600 font-semibold">This ride was free — covered by your referral credit.</p>
              <p className="fare-figure text-lg text-navy-400 line-through">{currencyFormat(Number(ride.final_fare), ride.currency)}</p>
            </>
          ) : (
            <>
              <p className="text-navy-500">Trip complete. You paid</p>
              <p className="fare-figure text-2xl font-bold">{currencyFormat(Number(ride.final_fare), ride.currency)}</p>
            </>
          )}
          {!ratingSubmitted ? (
            <DriverRatingForm
              stars={stars}
              onStarsChange={setStars}
              tagPoliteness={tagPoliteness}
              onTagPolitenessChange={setTagPoliteness}
              tagPunctuality={tagPunctuality}
              onTagPunctualityChange={setTagPunctuality}
              tagCleanliness={tagCleanliness}
              onTagCleanlinessChange={setTagCleanliness}
              showOtherComment={showOtherComment}
              onShowOtherCommentChange={setShowOtherComment}
              otherComment={otherComment}
              onOtherCommentChange={setOtherComment}
              onSubmit={submitRating}
              submitting={busy}
            />
          ) : (
            <p className="text-jade-600 font-medium">Thanks for rating your trip!</p>
          )}
          <DownloadReceiptButton
            ride={ride}
            driverName={ride.driver_name_snapshot}
            vehicleLabel={ride.vehicle_snapshot}
            plate={ride.plate_snapshot}
          />
          <button className="btn-dark w-full" onClick={() => router.push("/rider")}>
            Book another ride
          </button>
        </div>
      )}

      {ride.status === "cancelled" && (
        <div className="card p-5 text-center">
          <p className="text-navy-500">This ride was cancelled.</p>
          <button className="btn-dark w-full mt-4" onClick={() => router.push("/rider")}>
            Book another ride
          </button>
        </div>
      )}
    </div>
  );
}
