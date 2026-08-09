import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const LOCK_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const STRIKE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000; // ~3 months, rolling
const SUSPENSION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { reason, noShowReport, forceFlag } = await req.json().catch(() => ({ reason: null, noShowReport: false, forceFlag: false }));

  const { data: ride } = await supabase
    .from("rides")
    .select(
      "rider_id, driver_id, status, applied_credit_id, wallet_applied, currency, is_scheduled, scheduled_at, no_show_penalty_charged, commission_reserved"
    )
    .eq("id", id)
    .single();
  if (!ride) return NextResponse.json({ error: "Ride not found" }, { status: 404 });

  if (ride.rider_id !== user.id && ride.driver_id !== user.id) {
    return NextResponse.json({ error: "Not part of this ride" }, { status: 403 });
  }
  if (ride.status === "completed" || ride.status === "cancelled") {
    return NextResponse.json({ error: "Ride already finished" }, { status: 409 });
  }

  const admin = createAdminClient();
  const isDriver = ride.driver_id === user.id;
  const isRider = ride.rider_id === user.id;

  // Unified flag-based consequence for either role cancelling within the
  // 1-hour lock window (or a driver no-show) on a scheduled ride —
  // deliberately not monetary. A single flag carries no consequence by
  // itself; a second flag within a rolling 3-month window results in a
  // 7-day suspension, not a permanent ban. no_show_penalty_charged is
  // reused here as a "strike already applied to this ride" guard, despite
  // its now-outdated name, to avoid double-striking if cancel is somehow
  // called twice for the same ride. forceFlag bypasses the lock-window
  // check entirely — used when someone proposed a mutual cancellation,
  // the other party explicitly rejected it, and they cancel anyway: that
  // deliberate override of an explicit objection deserves a flag
  // regardless of how far in advance it happens, unlike an ordinary
  // early cancellation with no such disagreement attached to it.
  let strikeApplied = false;
  let suspensionApplied = false;
  if (ride.is_scheduled && ride.scheduled_at && ride.status === "accepted" && !ride.no_show_penalty_charged) {
    const withinLockWindow = new Date(ride.scheduled_at).getTime() - Date.now() <= LOCK_WINDOW_MS;

    if ((isDriver || isRider) && (withinLockWindow || forceFlag)) {
      strikeApplied = true;
      // A rider reporting a driver no-show strikes the driver, not
      // themselves — they aren't the one who committed the infraction.
      const profileId = noShowReport && isRider ? ride.driver_id : isDriver ? ride.driver_id : ride.rider_id;
      const role = noShowReport && isRider ? "driver" : isDriver ? "driver" : "rider";

      await admin.from("cancellation_strikes").insert({ profile_id: profileId, role, ride_id: id });

      const windowStart = new Date(Date.now() - STRIKE_WINDOW_MS).toISOString();
      const { count } = await admin
        .from("cancellation_strikes")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", profileId)
        .gte("created_at", windowStart);

      if ((count || 0) >= 2) {
        suspensionApplied = true;
        const suspendedUntil = new Date(Date.now() + SUSPENSION_MS).toISOString();
        if (isDriver) {
          await admin
            .from("driver_profiles")
            .update({ suspended_until: suspendedUntil, suspension_reason: "Second late-cancellation/no-show flag on a scheduled ride within 3 months" })
            .eq("user_id", profileId);
        } else {
          await admin.from("profiles").update({ suspended_until: suspendedUntil }).eq("id", profileId);
        }
      }
    }
  }

  const { error } = await admin
    .from("rides")
    .update({
      status: "cancelled",
      cancel_reason: reason,
      cancelled_by: user.id,
      no_show_penalty_charged: strikeApplied ? true : ride.no_show_penalty_charged,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // A reservation held against this ride (see accept-offer) never
  // becomes a real deduction now — release it back to the driver's
  // available balance.
  if (ride.commission_reserved && ride.driver_id) {
    const { data: driverProfile } = await admin
      .from("driver_profiles")
      .select("reserved_balance")
      .eq("user_id", ride.driver_id)
      .single();
    const newReserved = Math.max(Number(driverProfile?.reserved_balance || 0) - Number(ride.commission_reserved), 0);
    await admin.from("driver_profiles").update({ reserved_balance: newReserved }).eq("user_id", ride.driver_id);
  }

  if (ride.applied_credit_id) {
    await admin.from("ride_credits").update({ status: "available", used_ride_id: null }).eq("id", ride.applied_credit_id);
  }

  if (Number(ride.wallet_applied) > 0) {
    const { data: riderProfile } = await admin.from("profiles").select("wallet_balance").eq("id", ride.rider_id).single();
    await admin
      .from("profiles")
      .update({ wallet_balance: Number(riderProfile?.wallet_balance || 0) + Number(ride.wallet_applied) })
      .eq("id", ride.rider_id);
    await admin.from("wallet_transactions").insert({
      rider_id: ride.rider_id,
      ride_id: id,
      type: "refunded",
      amount: Number(ride.wallet_applied),
      currency: ride.currency,
      notes: "Ride cancelled — wallet amount refunded",
    });
  }

  return NextResponse.json({ ok: true, strikeApplied, suspensionApplied });
}
