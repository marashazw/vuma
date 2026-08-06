import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const LOCK_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const NO_SHOW_PENALTY_RATE = 0.5; // 50% of trip value

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { reason } = await req.json().catch(() => ({ reason: null }));

  const { data: ride } = await supabase
    .from("rides")
    .select(
      "rider_id, driver_id, status, applied_credit_id, wallet_applied, currency, is_scheduled, scheduled_at, no_show_penalty_charged, final_fare, rider_offer"
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

  // Scheduled-ride lock-window consequences — only relevant for an
  // accepted scheduled ride, and only once (no_show_penalty_charged
  // guards against a double-charge if cancel is somehow called twice).
  let strikeApplied = false;
  let penaltyCharged = 0;
  if (ride.is_scheduled && ride.scheduled_at && ride.status === "accepted" && !ride.no_show_penalty_charged) {
    const withinLockWindow = new Date(ride.scheduled_at).getTime() - Date.now() <= LOCK_WINDOW_MS;

    if (isDriver && withinLockWindow) {
      const fare = Number(ride.final_fare ?? ride.rider_offer);
      penaltyCharged = Math.round(fare * NO_SHOW_PENALTY_RATE * 100) / 100;
      const { data: driverProfile } = await admin
        .from("driver_profiles")
        .select("prepaid_wallet_balance")
        .eq("user_id", ride.driver_id)
        .single();
      const balanceAfter = Math.round((Number(driverProfile?.prepaid_wallet_balance || 0) - penaltyCharged) * 100) / 100;
      await admin.from("driver_profiles").update({ prepaid_wallet_balance: balanceAfter }).eq("user_id", ride.driver_id);
      await admin.from("driver_wallet_transactions").insert({
        driver_id: ride.driver_id,
        ride_id: id,
        type: "no_show_penalty",
        amount: -penaltyCharged,
        balance_after: balanceAfter,
        notes: "50% no-show/late-cancellation penalty on a scheduled ride",
      });
    }

    if (isRider && withinLockWindow) {
      strikeApplied = true;
      const { data: riderProfile } = await admin.from("profiles").select("scheduled_ride_strikes").eq("id", ride.rider_id).single();
      const newStrikes = (riderProfile?.scheduled_ride_strikes || 0) + 1;
      await admin
        .from("profiles")
        .update({ scheduled_ride_strikes: newStrikes, is_suspended: newStrikes >= 2 })
        .eq("id", ride.rider_id);
    }
  }

  const { error } = await admin
    .from("rides")
    .update({
      status: "cancelled",
      cancel_reason: reason,
      cancelled_by: user.id,
      no_show_penalty_charged: penaltyCharged > 0 ? true : ride.no_show_penalty_charged,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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

  return NextResponse.json({ ok: true, penaltyCharged, strikeApplied });
}
