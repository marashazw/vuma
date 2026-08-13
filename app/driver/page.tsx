"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { expireStaleOffers } from "@/lib/offers";
import { haversineKm } from "@/lib/geo";
import { currencyFormat } from "@/lib/commission";
import { checkLowBalance, getRemainingChangeCreditRoom, type LowBalanceCheck } from "@/lib/wallet";
import type { Ride, DriverProfile, CountryCode } from "@/lib/types";
import { Loader2, Power, MapPin, ArrowRight, Users, Check, Sparkles, CalendarClock, AlertTriangle } from "lucide-react";
import { useModal } from "@/components/ui/ModalProvider";
import { TripReminder } from "@/components/ui/TripReminder";
import { checkRideAccessRestriction } from "@/lib/vumaAssociates";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function DriverHomePage() {
  const modal = useModal();
  const supabase = createClient();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [requests, setRequests] = useState<Ride[]>([]);
  const [myBids, setMyBids] = useState<Map<string, { offerId: string; amount: number }>>(new Map());
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [lowBalance, setLowBalance] = useState<LowBalanceCheck | null>(null);
  const [remainingCreditRoom, setRemainingCreditRoom] = useState<number | null>(null);
  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(null);
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [stopCounts, setStopCounts] = useState<Record<string, number>>({});
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [bidAmounts, setBidAmounts] = useState<Record<string, number>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deluxeMultiplier, setDeluxeMultiplier] = useState(1.5);
  const userIdRef = useRef<string | null>(null);

  const loadActiveRide = useCallback(
    async (uid: string) => {
      // An actually-in-progress trip always wins, regardless of when it
      // was created relative to anything else — this is what the driver
      // is doing right now. Checked first and separately from "accepted",
      // rather than sorting the two together by created_at, which was the
      // actual bug: a scheduled ride accepted moments ago (for hours from
      // now) would outrank a trip that's been in progress for the last 20
      // minutes, simply by being more recently created.
      const { data: inProgress } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", uid)
        .eq("status", "in_progress")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (inProgress) {
        setActiveRide(inProgress as Ride);
        return;
      }

      // No in-progress trip — fall back to an accepted, immediate ride
      // (something the driver genuinely needs to act on now, like heading
      // to a pickup). Deliberately excludes accepted rides that are
      // scheduled for later: those aren't "active" in any meaningful
      // sense yet, and are already surfaced separately via the trip
      // reminder banner rather than needing to show here too.
      const { data: acceptedNow } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", uid)
        .eq("status", "accepted")
        .eq("is_scheduled", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveRide((acceptedNow as Ride) || null);

      // Auto-navigate only for an immediate acceptance — a scheduled
      // acceptance shouldn't yank the driver away from whatever they're
      // currently doing, since there's nothing to act on yet.
      if (acceptedNow && typeof window !== "undefined") {
        const key = `vuma-auto-nav-${acceptedNow.id}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          router.push(`/driver/rides/${acceptedNow.id}?justAccepted=1`);
        }
      }
    },
    [supabase, router]
  );


  const loadDriverProfile = useCallback(
    async (uid: string) => {
      const { data } = await supabase.from("driver_profiles").select("*").eq("user_id", uid).single();
      setDriverProfile(data as DriverProfile);
      const { data: sub } = await supabase
        .from("driver_subscriptions")
        .select("id")
        .eq("driver_id", uid)
        .in("status", ["active", "waived"])
        .gte("ends_at", new Date().toISOString())
        .limit(1)
        .maybeSingle();
      setHasActiveSubscription(!!sub);
      const availableForLowBalanceCheck = (Number(data?.prepaid_wallet_balance) || 0) - (Number(data?.reserved_balance) || 0);
      setLowBalance(await checkLowBalance(supabase, uid, availableForLowBalanceCheck));

      const { data: profile } = await supabase.from("profiles").select("country").eq("id", uid).single();
      setRemainingCreditRoom(await getRemainingChangeCreditRoom(supabase, uid, (profile?.country as CountryCode) || "ZA"));
    },
    [supabase]
  );

  const loadRequests = useCallback(async () => {
    const { data } = await supabase
      .from("rides")
      .select("*")
      .in("status", ["requested", "negotiating"])
      .order("created_at", { ascending: false });
    setRequests((data as Ride[]) || []);

    const rideIds = (data || []).map((r) => r.id);
    if (rideIds.length) {
      const { data: stopsData } = await supabase.from("ride_stops").select("ride_id").in("ride_id", rideIds);
      const counts: Record<string, number> = {};
      (stopsData || []).forEach((s) => {
        counts[s.ride_id] = (counts[s.ride_id] || 0) + 1;
      });
      setStopCounts(counts);
    } else {
      setStopCounts({});
    }

    if (userIdRef.current) {
      await expireStaleOffers(supabase, { driverId: userIdRef.current });
      const { data: myOffers } = await supabase
        .from("ride_offers")
        .select("id, ride_id, amount")
        .eq("driver_id", userIdRef.current)
        .eq("status", "pending");
      setMyBids(new Map((myOffers || []).map((o) => [o.ride_id, { offerId: o.id, amount: Number(o.amount) }])));
    }
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.push("/login");
      setUserId(user.id);
      userIdRef.current = user.id;
      const { data: profile } = await supabase.from("profiles").select("country").eq("id", user.id).single();
      const { data: fareData } = await supabase
        .from("fare_settings")
        .select("deluxe_multiplier")
        .eq("country", profile?.country || "ZA")
        .single();
      if (fareData?.deluxe_multiplier) setDeluxeMultiplier(Number(fareData.deluxe_multiplier));
      await loadDriverProfile(user.id);
      await loadRequests();
      await loadActiveRide(user.id);
      setLoading(false);
    })();

    const channel = supabase
      .channel("open-rides")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
        loadRequests();
        if (userIdRef.current) loadActiveRide(userIdRef.current);
      })
      .subscribe();

    // Safety net alongside realtime — see rider ride detail page for rationale.
    const poll = setInterval(() => {
      loadRequests();
      if (userIdRef.current) loadActiveRide(userIdRef.current);
      if (userIdRef.current) loadDriverProfile(userIdRef.current);
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Own profile — verification approval, suspension, deluxe certification,
  // and credit balance all live here, and any of them can change from the
  // admin side while a driver already has this dashboard open. Without
  // this, a driver who was mid-session when approved would see no change
  // until a full manual reload, even though the admin side already shows
  // them as verified. Kept as its own effect (rather than in the mount
  // effect above) since it needs the real userId, which isn't known yet
  // at the point that effect's subscriptions are set up.
  useEffect(() => {
    if (!userId) return;
    const profileChannel = supabase
      .channel("own-driver-profile")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "driver_profiles", filter: `user_id=eq.${userId}` },
        () => loadDriverProfile(userId)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [userId, supabase, loadDriverProfile]);

  const isSuspended = !!(driverProfile?.suspended_until && new Date(driverProfile.suspended_until) > new Date());

  async function toggleOnline() {
    if (!userId || !driverProfile) return;
    if (driverProfile.verification_status !== "verified") return;
    if (isSuspended) return;
    const next = !driverProfile.is_online;

    const availableBalance = Number(driverProfile.prepaid_wallet_balance) - Number(driverProfile.reserved_balance || 0);
    if (next && !hasActiveSubscription && availableBalance <= 0) {
      await modal.alert(
        "Your prepaid wallet is empty. Top up your wallet, or switch to a subscription plan, before going online."
      );
      return;
    }

    // Location is now tracked continuously by the global LocationBroadcaster
    // (mounted in the driver layout) regardless of online/trip status — no
    // separate watch needed here.
    await supabase.from("driver_profiles").update({ is_online: next }).eq("user_id", userId);
    setDriverProfile({ ...driverProfile, is_online: next });
  }

  async function submitBid(ride: Ride) {
    if (!userId) return;
    const amount = bidAmounts[ride.id] ?? ride.rider_offer;

    const restrictionCheck = await checkRideAccessRestriction(supabase, userId, ride.is_deluxe);
    if (restrictionCheck.restricted) {
      await modal.alert(restrictionCheck.reason || "This ride isn't currently available to you.");
      return;
    }

    if (!hasActiveSubscription) {
      const affordRes = await fetch(`/api/rides/${ride.id}/check-bid-affordability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bidAmount: amount }),
      });
      const affordData = await affordRes.json();
      if (affordRes.ok && !affordData.canBid) {
        await modal.alert(
          `You've run out of wallet balance to cover this trip's commission. Top up your wallet, or switch to a subscription plan, to keep bidding.`
        );
        return;
      }
    }

    setSubmittingId(ride.id);

    const { data: inserted, error: insertErr } = await supabase
      .from("ride_offers")
      .insert({
        ride_id: ride.id,
        driver_id: userId,
        amount,
        status: "pending",
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[submitBid] failed to submit offer:", insertErr);
      await modal.alert(`Could not submit your bid: ${insertErr.message}`);
      setSubmittingId(null);
      return;
    }

    if (ride.status === "requested") {
      const { error: statusErr } = await supabase.from("rides").update({ status: "negotiating" }).eq("id", ride.id);
      if (statusErr) {
        console.error("[submitBid] failed to mark ride as negotiating (non-fatal):", statusErr);
      }
    }

    setMyBids((prev) => new Map(prev).set(ride.id, { offerId: inserted.id, amount: Number(inserted.amount) }));

    await loadRequests();
    setSubmittingId(null);
  }

  async function matchRiderOffer(ride: Ride) {
    const bid = myBids.get(ride.id);
    if (!bid) return;
    setMatchingId(ride.id);
    const { error } = await supabase
      .from("ride_offers")
      .update({ amount: ride.rider_offer })
      .eq("id", bid.offerId)
      .eq("status", "pending");
    setMatchingId(null);
    if (error) {
      console.error("[matchRiderOffer] failed:", error);
      await modal.alert(`Could not update your bid: ${error.message}`);
      return;
    }
    setMyBids((prev) => new Map(prev).set(ride.id, { offerId: bid.offerId, amount: Number(ride.rider_offer) }));
    await loadRequests();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  // Client-side filter for immediate UX; the database also hard-enforces
  // this at the point of bidding (see migration 006), so this can't be
  // bypassed even if a request briefly shows before this filter applies.
  const visibleRequests = requests.filter(
    (r) => r.seats_required <= (driverProfile?.vehicle_seats || 0) && (!r.is_deluxe || driverProfile?.deluxe_status === "certified")
  );

  return (
    <div className="space-y-5">
      <TripReminder role="driver" />

      <Link
        href="/vuma-private"
        className="flex items-center justify-between text-xs text-navy-400 hover:text-navy-600"
      >
        <span>Have your own circle to help with rides? Try Vuma Private — cost-share, no fares</span>
        <span className="shrink-0 ml-2">→</span>
      </Link>

      {lowBalance?.isLow && (
        <Link href="/driver/wallet" className="card p-4 flex items-center gap-2.5 bg-gold-50 border-gold-200 block">
          <AlertTriangle className="w-4 h-4 text-gold-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gold-700">
              {Number(driverProfile?.prepaid_wallet_balance) - Number(driverProfile?.reserved_balance || 0) <= 0
                ? "You have no credit — top up to take new trips"
                : "Your wallet balance is getting low"}
            </p>
            <p className="text-xs text-navy-500">Tap to top up before it runs out.</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gold-600 shrink-0" />
        </Link>
      )}

      {activeRide && (
        <Link href={`/driver/rides/${activeRide.id}`} className="card p-4 flex items-center justify-between bg-navy-800 text-paper block">
          <div>
            <p className="text-xs text-navy-300 uppercase tracking-wide font-semibold">Active trip</p>
            <p className="font-semibold">{activeRide.dropoff_address.split(",")[0]}</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gold-400" />
        </Link>
      )}

      {isSuspended && (
        <div className="card p-4 bg-coral-500/5 border-coral-500/20">
          <p className="font-semibold text-sm text-coral-700">You're suspended until {new Date(driverProfile!.suspended_until!).toLocaleDateString()}</p>
          <p className="text-xs text-coral-600 mt-0.5">{driverProfile?.suspension_reason}</p>
        </div>
      )}

      {driverProfile?.verification_status !== "verified" && (
        <Link href="/driver/verification" className="card p-4 flex items-center justify-between bg-gold-50 border-gold-200 block">
          <div>
            <p className="font-semibold text-sm text-gold-700">
              {driverProfile?.verification_status === "pending" && driverProfile?.submitted_at
                ? "Verification pending"
                : "Get verified to go online"}
            </p>
            <p className="text-xs text-gold-600 mt-0.5">
              {driverProfile?.verification_status === "pending" && driverProfile?.submitted_at
                ? "An admin is reviewing your documents."
                : "Upload your ID, license, and vehicle documents, then submit for review here."}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-gold-600" />
        </Link>
      )}

      {driverProfile?.verification_status === "verified" && !driverProfile?.vehicle_seats && (
        <Link href="/driver/verification" className="card p-4 flex items-center justify-between bg-gold-50 border-gold-200 block">
          <div>
            <p className="font-semibold text-sm text-gold-700">Set your vehicle's seat capacity</p>
            <p className="text-xs text-gold-600 mt-0.5">Required before you can bid on any ride request.</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gold-600" />
        </Link>
      )}

      <div className="card p-5 flex items-center justify-between">
        <div>
          <p className="label mb-1">Status</p>
          <p className={cn("font-display font-semibold", driverProfile?.is_online ? "text-jade-600" : "text-navy-400")}>
            {isSuspended ? "Suspended" : driverProfile?.is_online ? "Online — visible to riders" : "Offline"}
          </p>
        </div>
        <button
          onClick={toggleOnline}
          disabled={driverProfile?.verification_status !== "verified" || isSuspended}
          className={cn("btn", driverProfile?.is_online ? "bg-jade-500 text-white" : "bg-navy-100 text-navy-500")}
        >
          <Power className="w-4 h-4" /> {driverProfile?.is_online ? "Go offline" : "Go online"}
        </button>
      </div>

      {!driverProfile?.is_online ? (
        <div className="card p-8 text-center text-navy-400">Go online to see nearby ride requests.</div>
      ) : visibleRequests.length === 0 ? (
        <div className="card p-8 text-center text-navy-400">
          {requests.length > 0
            ? "No open requests match your car's seat capacity right now."
            : "No open requests right now — hang tight."}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="label">Open requests ({visibleRequests.length})</p>
          {visibleRequests.map((r) => {
            const distToPickup =
              driverProfile.current_lat && driverProfile.current_lng
                ? haversineKm(driverProfile.current_lat, driverProfile.current_lng, r.pickup_lat, r.pickup_lng)
                : null;
            return (
              <div key={r.id} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-jade-500" /> {r.pickup_address.split(",")[0]}
                    </p>
                    <p className="text-xs text-navy-400 mt-0.5">to {r.dropoff_address.split(",")[0]}</p>
                    <span className="pill bg-navy-50 text-navy-500 mt-1.5 mr-1.5">
                      <Users className="w-3 h-3" /> {r.seats_required} seat{r.seats_required > 1 ? "s" : ""}
                    </span>
                    {r.is_scheduled && (
                      <button
                        type="button"
                        className="pill bg-terracotta-50 mt-1.5 mr-1.5"
                        style={{ backgroundColor: "#FBEAE3", color: "#B85C3E" }}
                        onClick={() => setExpandedScheduleId(expandedScheduleId === r.id ? null : r.id)}
                      >
                        <CalendarClock className="w-3 h-3" /> SCHEDULED TRIP — view details
                      </button>
                    )}
                    {stopCounts[r.id] > 0 && (
                      <span className="pill bg-gold-50 text-gold-700 mt-1.5 mr-1.5">
                        <MapPin className="w-3 h-3" /> {stopCounts[r.id]} stop{stopCounts[r.id] > 1 ? "s" : ""} — not direct
                      </span>
                    )}
                    {r.is_deluxe && (
                      <span className="pill bg-navy-800 text-gold-400 mt-1.5 mr-1.5">
                        <Sparkles className="w-3 h-3" /> Vuma Deluxe — {deluxeMultiplier}× commission
                      </span>
                    )}
                    {r.applied_credit_id && (
                      <span className="pill bg-gold-50 text-gold-600 mt-1.5">Referral credit — 0% commission + priority</span>
                    )}
                    {r.wallet_applied > 0 && (
                      <span className="pill bg-jade-50 text-jade-700 mt-1.5">
                        {currencyFormat(r.wallet_applied, r.currency)} wallet credit — rider pays{" "}
                        {currencyFormat(Math.max(r.rider_offer - r.wallet_applied, 0), r.currency)} cash, you get spendable
                        credit for the rest (subscription/priority only)
                      </span>
                    )}
                    {r.wallet_applied > 0 && remainingCreditRoom !== null && r.wallet_applied > remainingCreditRoom && (
                      <span className="pill bg-coral-500/10 text-coral-700 mt-1.5">
                        You'd only be compensated {currencyFormat(remainingCreditRoom, r.currency)} of that{" "}
                        {currencyFormat(r.wallet_applied, r.currency)} — you're near your monthly redemption limit
                      </span>
                    )}
                  </div>
                  <p className="fare-figure font-semibold text-navy-700">{currencyFormat(r.rider_offer, r.currency)}</p>
                </div>
                {r.is_scheduled && expandedScheduleId === r.id && (
                  <div className="rounded-lg p-3 mb-3 text-sm" style={{ backgroundColor: "#FBEAE3" }}>
                    <p className="font-semibold" style={{ color: "#B85C3E" }}>
                      Scheduled for{" "}
                      {r.scheduled_at &&
                        (() => {
                          const d = new Date(r.scheduled_at);
                          const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                          const date = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
                          return `${time}, ${date}`;
                        })()}
                    </p>
                    <p className="text-xs text-navy-500 mt-1">
                      Cancelling within 1 hour of this time, or not showing up, flags your account. A second flag
                      within 3 months results in a 7-day suspension.
                    </p>
                  </div>
                )}
                {distToPickup !== null && <p className="text-xs text-navy-400 mb-3">{distToPickup.toFixed(1)} km to pickup</p>}
                {myBids.has(r.id) ? (
                  (() => {
                    const bid = myBids.get(r.id)!;
                    const riderOffer = Number(r.rider_offer);
                    if (riderOffer >= bid.amount) {
                      // Rider's offer already meets or beats what the
                      // driver bid — nothing for the driver to do, the
                      // ball is in the rider's court to accept.
                      return (
                        <button className="btn-ghost w-full !text-jade-600 !border-jade-200 !bg-jade-50" disabled>
                          <Check className="w-4 h-4" /> Your bid ({currencyFormat(bid.amount, r.currency)}) — waiting
                          for rider to accept
                        </button>
                      );
                    }
                    // Rider has countered below the driver's bid — give
                    // them a clear, actionable choice instead of a
                    // passive "waiting" badge that never changes.
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-gold-700 bg-gold-50 rounded-lg px-3 py-2">
                          Rider countered at {currencyFormat(riderOffer, r.currency)} (your bid was{" "}
                          {currencyFormat(bid.amount, r.currency)})
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-navy-400 flex-1">
                            Your bid of {currencyFormat(bid.amount, r.currency)} still stands — the rider can accept
                            it anytime.
                          </p>
                          <button
                            className="btn-primary !text-sm shrink-0"
                            disabled={matchingId === r.id}
                            onClick={() => matchRiderOffer(r)}
                          >
                            {matchingId === r.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              `Match ${currencyFormat(riderOffer, r.currency)}`
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="input"
                      defaultValue={r.rider_offer}
                      onChange={(e) => setBidAmounts((b) => ({ ...b, [r.id]: Number(e.target.value) }))}
                    />
                    <button
                      className="btn-primary shrink-0"
                      disabled={submittingId === r.id}
                      onClick={() => submitBid(r)}
                    >
                      {submittingId === r.id && <Loader2 className="w-4 h-4 animate-spin" />} Bid
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
