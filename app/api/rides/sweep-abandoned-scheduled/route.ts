import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Called opportunistically from normal app usage (rider/driver dashboard
 * loads), same no-cron-job pattern as sweep-stale-negotiations — Vercel's
 * Hobby-tier cron limits make a real scheduled job impractical here.
 *
 * A genuinely different problem from sweep-stale-negotiations: that one
 * catches a scheduled ride that never even got matched to a driver. This
 * one catches a scheduled ride that DID get matched (status = 'accepted')
 * but was then abandoned — neither the driver ever tapped Start, nor
 * either party ever cancelled or reported a no-show. The count-zero
 * arrival-confirmation dialogs in TripReminder are the intended way this
 * resolves, but they only fire while someone is actually looking at the
 * app — if neither party opens it around the scheduled time, nothing
 * ever prompts a resolution, and the ride just sits in 'accepted'
 * indefinitely. For a driver on a wallet plan, this specifically means
 * their commission reservation for that ride (see accept-offer) never
 * gets released, quietly reducing their available balance forever with
 * no ride left anywhere in the UI to explain why.
 *
 * A generous 24-hour grace period past the scheduled time before this
 * acts — this is a last-resort safety net, not the primary resolution
 * path, which should already have happened via TripReminder well before
 * this would ever fire.
 */
const GRACE_MS = 24 * 60 * 60 * 1000;

export async function POST() {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - GRACE_MS).toISOString();

  const { data: abandoned } = await admin
    .from("rides")
    .select("id, rider_id, driver_id, applied_credit_id, wallet_applied, currency, commission_reserved")
    .eq("status", "accepted")
    .eq("is_scheduled", true)
    .lt("scheduled_at", cutoff);

  for (const ride of abandoned || []) {
    await admin
      .from("rides")
      .update({ status: "cancelled", cancel_reason: "Auto-cancelled — scheduled trip was never started or resolved by either party" })
      .eq("id", ride.id);

    // Same reservation-release logic as the manual cancel route — this
    // ride never became a real deduction, so nothing should still be
    // held against it.
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
        ride_id: ride.id,
        type: "refunded",
        amount: Number(ride.wallet_applied),
        currency: ride.currency,
        notes: "Scheduled ride auto-cancelled (never resolved) — wallet amount refunded",
      });
    }
  }

  return NextResponse.json({ ok: true, swept: abandoned?.length || 0 });
}
