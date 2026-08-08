import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCommissionPct, commissionAmount } from "@/lib/commission";
import { COUNTRIES } from "@/lib/constants";
import type { CountryCode } from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

function startOfMonthUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * After a rider's first-ever completed ride, checks whether they were
 * referred and, if so, marks that referral qualified. If the referrer has
 * now crossed the admin-configured threshold, issues them a ride credit.
 */
async function processReferralQualification(admin: AdminClient, riderId: string) {
  try {
    const { count: priorCompleted } = await admin
      .from("rides")
      .select("id", { count: "exact", head: true })
      .eq("rider_id", riderId)
      .eq("status", "completed");

    // This ride was already marked completed before this runs, so "1" means
    // this is their first-ever completed ride.
    if ((priorCompleted || 0) !== 1) return;

    const { data: referral } = await admin
      .from("referrals")
      .select("*")
      .eq("referred_id", riderId)
      .eq("status", "pending")
      .maybeSingle();
    if (!referral) return;

    await admin
      .from("referrals")
      .update({ status: "qualified", qualified_at: new Date().toISOString() })
      .eq("id", referral.id);

    const { data: referrerProfile } = await admin
      .from("profiles")
      .select("*")
      .eq("id", referral.referrer_id)
      .single();
    if (!referrerProfile) return;

    const { data: settings } = await admin
      .from("referral_settings")
      .select("*")
      .eq("country", referrerProfile.country)
      .single();
    if (!settings || !settings.is_active) return;

    const { data: readyReferrals } = await admin
      .from("referrals")
      .select("*")
      .eq("referrer_id", referral.referrer_id)
      .eq("status", "qualified")
      .eq("counted_toward_reward", false)
      .order("created_at", { ascending: true });

    if (!readyReferrals || readyReferrals.length < settings.required_referrals) return;

    const batch = readyReferrals.slice(0, settings.required_referrals);
    await admin
      .from("referrals")
      .update({ status: "rewarded", counted_toward_reward: true })
      .in("id", batch.map((r) => r.id));

    await admin.from("ride_credits").insert({
      rider_id: referral.referrer_id,
      amount: settings.credit_amount,
      currency: settings.currency,
      source: "referral",
      status: "available",
    });
  } catch {
    // Referral rewards are a bonus feature — never let a hiccup here block
    // the ride completion the driver is waiting on.
  }
}

/**
 * After a driver completes a ride, checks whether they were referred by
 * another driver and, once they've completed enough rides (admin-configured
 * minimum), marks that referral qualified — unless their account is flagged
 * for a duplicate vehicle plate, in which case qualification is withheld
 * pending admin review. Once the referrer has enough qualified referrals,
 * pays the reward straight into the referrer's spendable credit_balance
 * (same balance used for change-credit redemption — subscription/priority
 * only, never cash).
 */
async function processDriverReferralQualification(admin: AdminClient, driverId: string) {
  try {
    const { data: referral } = await admin
      .from("driver_referrals")
      .select("*")
      .eq("referred_id", driverId)
      .eq("status", "pending")
      .maybeSingle();
    if (!referral) return;

    const { data: referredProfile } = await admin.from("profiles").select("country").eq("id", driverId).single();
    if (!referredProfile) return;

    const { data: settings } = await admin
      .from("driver_referral_settings")
      .select("*")
      .eq("country", referredProfile.country)
      .single();
    if (!settings || !settings.is_active) return;

    const { count: completedRideCount } = await admin
      .from("rides")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", driverId)
      .eq("status", "completed");

    if ((completedRideCount || 0) < settings.min_rides_to_qualify) return;

    const { data: referredDriverProfile } = await admin
      .from("driver_profiles")
      .select("duplicate_vehicle_flag")
      .eq("user_id", driverId)
      .single();

    if (referredDriverProfile?.duplicate_vehicle_flag) {
      // Meets the ride threshold, but flagged for a duplicate vehicle plate
      // — hold for admin review instead of auto-qualifying.
      await admin.from("driver_referrals").update({ status: "flagged" }).eq("id", referral.id);
      return;
    }

    await admin
      .from("driver_referrals")
      .update({ status: "qualified", qualified_at: new Date().toISOString() })
      .eq("id", referral.id);

    const { data: referrerProfile } = await admin.from("profiles").select("*").eq("id", referral.referrer_id).single();
    if (!referrerProfile) return;

    const { data: referrerSettings } = await admin
      .from("driver_referral_settings")
      .select("*")
      .eq("country", referrerProfile.country)
      .single();
    if (!referrerSettings || !referrerSettings.is_active) return;

    const { data: readyReferrals } = await admin
      .from("driver_referrals")
      .select("*")
      .eq("referrer_id", referral.referrer_id)
      .eq("status", "qualified")
      .eq("counted_toward_reward", false)
      .order("created_at", { ascending: true });

    if (!readyReferrals || readyReferrals.length < referrerSettings.required_referrals) return;

    const batch = readyReferrals.slice(0, referrerSettings.required_referrals);
    await admin
      .from("driver_referrals")
      .update({ status: "rewarded", counted_toward_reward: true })
      .in("id", batch.map((r) => r.id));

    const { data: referrerDriverProfile } = await admin
      .from("driver_profiles")
      .select("credit_balance")
      .eq("user_id", referral.referrer_id)
      .single();

    await admin
      .from("driver_profiles")
      .update({ credit_balance: Number(referrerDriverProfile?.credit_balance || 0) + referrerSettings.credit_amount })
      .eq("user_id", referral.referrer_id);

    await admin.from("driver_credit_transactions").insert({
      driver_id: referral.referrer_id,
      type: "referral_reward",
      amount: referrerSettings.credit_amount,
      currency: referrerSettings.currency,
      notes: `Reward for ${referrerSettings.required_referrals} qualified driver referrals`,
    });
  } catch {
    // Referral rewards are a bonus feature — never let a hiccup here block
    // the ride completion the driver is waiting on.
  }
}

/**
 * If this ride was covered by rider wallet (change) credit, gives the
 * completing driver spendable credit_balance equal to the amount applied —
 * capped at their monthly redemption limit. If the cap is reached, the
 * driver gets only the remaining room (possibly zero), and the response
 * reflects that so the UI can tell them clearly.
 */
async function processChangeCreditRedemption(
  admin: AdminClient,
  ride: { id: string; driver_id: string; rider_id: string; country: string; currency: string; wallet_applied: number }
): Promise<{ creditGiven: number; creditCapped: boolean }> {
  const applied = Number(ride.wallet_applied) || 0;
  if (applied <= 0) return { creditGiven: 0, creditCapped: false };

  // Same admin-configurable source as the issuing side (credit-change
  // route) — keeps the two consistent with whatever the admin currently
  // has set, rather than the redemption side quietly using a stale
  // hardcoded value.
  const countryDefaults = COUNTRIES[ride.country as CountryCode];
  const { data: fareSettings } = await admin
    .from("fare_settings")
    .select("change_credit_driver_monthly")
    .eq("country", ride.country)
    .single();
  const driverMonthlyCap = fareSettings?.change_credit_driver_monthly ?? countryDefaults.changeCreditDriverMonthly;
  const monthStart = startOfMonthUTC();

  const { data: redeemedTxns } = await admin
    .from("driver_credit_transactions")
    .select("amount")
    .eq("driver_id", ride.driver_id)
    .eq("type", "redeemed_change_credit")
    .gte("created_at", monthStart);
  const redeemedSoFar = (redeemedTxns || []).reduce((sum, t) => sum + Number(t.amount), 0);

  const room = Math.max(driverMonthlyCap - redeemedSoFar, 0);
  const creditGiven = Math.min(applied, room);
  const creditCapped = creditGiven < applied;

  if (creditGiven > 0) {
    const { data: driverProfile } = await admin.from("driver_profiles").select("credit_balance").eq("user_id", ride.driver_id).single();
    await admin
      .from("driver_profiles")
      .update({ credit_balance: Number(driverProfile?.credit_balance || 0) + creditGiven })
      .eq("user_id", ride.driver_id);

    await admin.from("driver_credit_transactions").insert({
      driver_id: ride.driver_id,
      type: "redeemed_change_credit",
      amount: creditGiven,
      currency: ride.currency,
      ride_id: ride.id,
      rider_id: ride.rider_id,
      notes: creditCapped ? "Partial — monthly redemption limit reached" : "Rider's wallet credit applied to this ride",
    });
  }

  await admin.from("wallet_transactions").insert({
    rider_id: ride.rider_id,
    ride_id: ride.id,
    type: "redeemed",
    amount: 0, // rider's balance was already deducted when reserved at ride request time
    currency: ride.currency,
    notes: `Applied ${applied} ${ride.currency} of wallet balance toward this ride's cash payment`,
  });

  return { creditGiven, creditCapped };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { id: rideId } = await params;

  const { data: ride, error: rideErr } = await admin.from("rides").select("*").eq("id", rideId).single();
  if (rideErr || !ride) return NextResponse.json({ error: "Ride not found" }, { status: 404 });

  if (ride.driver_id !== user.id) {
    return NextResponse.json({ error: "Only the assigned driver can complete this ride" }, { status: 403 });
  }
  if (ride.status !== "in_progress") {
    return NextResponse.json({ error: "Ride is not in progress" }, { status: 409 });
  }

  const fare = Number(ride.final_fare ?? ride.rider_offer);

  const { data: driverProfile } = await admin
    .from("driver_profiles")
    .select("*")
    .eq("user_id", ride.driver_id)
    .single();

  const { data: driverPerson } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", ride.driver_id)
    .single();

  let pct: number;
  let source: string;
  let consumeFreeCredit = false;
  let creditValid = false;

  if (ride.applied_credit_id) {
    const { data: creditRow } = await admin
      .from("ride_credits")
      .select("rider_id, status")
      .eq("id", ride.applied_credit_id)
      .single();
    creditValid = !!creditRow && creditRow.rider_id === ride.rider_id && creditRow.status === "reserved";
  }

  // If commission was already resolved and deducted from the driver's
  // wallet at trip-start, reuse those exact figures rather than
  // re-resolving from scratch — subscription/override state could
  // theoretically have changed between start and completion, and
  // re-resolving here would silently disagree with what was actually
  // charged. free_ride_credits consumption still needs to be tracked here
  // regardless, since that's a completion-time bookkeeping step, not
  // something the wallet deduction itself handles.
  if (ride.wallet_commission_charged !== null && ride.wallet_commission_pct !== null) {
    pct = Number(ride.wallet_commission_pct);
    source =
      creditValid ? "referral_credit" : (driverProfile?.free_ride_credits || 0) > 0 ? "reward_credit" : "wallet_charged_at_start";
    if (!creditValid && (driverProfile?.free_ride_credits || 0) > 0 && pct === 0) consumeFreeCredit = true;
  } else if (creditValid) {
    // Rider used a referral credit — this ride carries no commission at all,
    // and the driver additionally gets a priority-ranking window as thanks
    // for honoring it.
    pct = 0;
    source = "referral_credit";
  } else if ((driverProfile?.free_ride_credits || 0) > 0) {
    // A previously-earned reward credit (e.g. from an SOS response) — burns
    // one credit on this ride.
    pct = 0;
    source = "reward_credit";
    consumeFreeCredit = true;
  } else {
    // NOTE: rider wallet (change) credit does NOT reduce commission — normal
    // commission always applies here. The driver is compensated separately
    // via a spendable credit_balance (see processChangeCreditRedemption),
    // not via a commission waiver on this ride.
    const { data: activeSub } = await admin
      .from("driver_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("driver_id", ride.driver_id)
      .in("status", ["active", "waived"])
      .gte("ends_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: commissionSetting } = await admin
      .from("commission_settings")
      .select("default_pct")
      .eq("country", ride.country)
      .single();

    const resolved = resolveCommissionPct({
      driver: driverProfile!,
      activeSubscription: activeSub as any,
      countryDefaultPct: commissionSetting?.default_pct ?? 10,
    });
    pct = resolved.pct;
    source = resolved.source;
  }

  // Vuma Deluxe: the commission rate itself scales by the admin-configured
  // multiplier on deluxe rides, on top of whatever rate would normally
  // apply — referral/reward credit rides stay unaffected since 0% × any
  // multiplier is still 0%. Skipped when pct came from the trip-start
  // wallet deduction, since the multiplier is already baked into that
  // figure — applying it again here would double it.
  let deluxeMultiplierUsed: number | null = null;
  if (ride.is_deluxe && ride.wallet_commission_charged === null) {
    const { data: fareSettings } = await admin
      .from("fare_settings")
      .select("deluxe_multiplier")
      .eq("country", ride.country)
      .single();
    const multiplier = Number(fareSettings?.deluxe_multiplier) || 1.5;
    deluxeMultiplierUsed = multiplier;
    pct = Math.min(pct * multiplier, 100);
  }

  const commission = commissionAmount(fare, pct);
  const driverTakeHome = fare - commission;
  const now = new Date().toISOString();

  const { error: updateErr } = await admin
    .from("rides")
    .update({
      status: "completed",
      completed_at: now,
      driver_name_snapshot: driverPerson?.full_name || null,
      vehicle_snapshot: [driverProfile?.vehicle_color, driverProfile?.vehicle_make, driverProfile?.vehicle_model]
        .filter(Boolean)
        .join(" ") || null,
      plate_snapshot: driverProfile?.plate_number || null,
    })
    .eq("id", rideId);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Note: the admin-facing transaction record for this ride's commission
  // is created at trip-start now (/api/rides/[id]/start), not here — that's
  // the moment the charge actually happens. Creating a second one here
  // would duplicate it for every ride.

  const driverUpdate: Record<string, any> = {
    total_earnings: (driverProfile?.total_earnings || 0) + driverTakeHome,
  };
  if (consumeFreeCredit) {
    driverUpdate.free_ride_credits = Math.max((driverProfile?.free_ride_credits || 1) - 1, 0);
  }

  // Note: where a rider covered part of this fare with their own Vuma
  // Wallet (change) credit, the driver is already correctly compensated
  // for that via processChangeCreditRedemption below (credit_balance,
  // capped at a monthly limit) — there used to be a second, separate
  // credit into prepaid_wallet_balance here for the exact same event,
  // which double-compensated the driver and silently bypassed the
  // monthly cap. Removed; processChangeCreditRedemption is the one place
  // this should happen.

  if (creditValid) {
    await admin
      .from("ride_credits")
      .update({ status: "used", used_at: now })
      .eq("id", ride.applied_credit_id);

    const { data: settings } = await admin
      .from("referral_settings")
      .select("driver_priority_days")
      .eq("country", ride.country)
      .single();

    const days = settings?.driver_priority_days ?? 7;
    const currentPriority = driverProfile?.priority_until ? new Date(driverProfile.priority_until) : new Date();
    const base = currentPriority > new Date() ? currentPriority : new Date();
    driverUpdate.priority_until = new Date(base.getTime() + days * 86400000).toISOString();

    const badges: string[] = Array.isArray(driverProfile?.badges) ? driverProfile.badges : [];
    if (!badges.includes("referral_hero")) driverUpdate.badges = [...badges, "referral_hero"];
  }

  await admin.from("driver_profiles").update(driverUpdate).eq("user_id", ride.driver_id);

  const { creditGiven, creditCapped } = await processChangeCreditRedemption(admin, ride);

  await processReferralQualification(admin, ride.rider_id);
  await processDriverReferralQualification(admin, ride.driver_id);

  return NextResponse.json({
    ok: true,
    fare,
    commissionPct: pct,
    commissionSource: source,
    commissionAmount: commission,
    driverTakeHome,
    walletApplied: Number(ride.wallet_applied) || 0,
    cashDue: Math.max(fare - (Number(ride.wallet_applied) || 0), 0),
    changeCreditGiven: creditGiven,
    changeCreditCapped: creditCapped,
    isDeluxe: ride.is_deluxe,
    deluxeMultiplier: deluxeMultiplierUsed,
  });
}
