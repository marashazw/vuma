import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const STALE_HOURS = 24;

/**
 * Called opportunistically from normal app usage (rider/driver dashboard
 * loads), same no-cron-job pattern as expireStaleOffers — Vercel's
 * Hobby-tier cron limits make a real scheduled job impractical here.
 *
 * Deliberately marks rides 'cancelled' rather than hard-deleting them:
 * several tables (ride_credits.used_ride_id, sos_alerts.ride_id,
 * transactions, ratings) reference rides WITHOUT cascading deletes, so a
 * literal delete risks a constraint violation the moment any of those
 * happens to apply — and even where it wouldn't, deleting the row would
 * silently orphan a referral credit or wallet hold instead of properly
 * releasing it back. This mirrors exactly what the manual cancel route
 * already does for a real cancellation.
 */
export async function POST() {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

  const { data: stale } = await admin
    .from("rides")
    .select("id, rider_id, applied_credit_id, wallet_applied, currency")
    .in("status", ["requested", "negotiating"])
    .lt("created_at", cutoff);

  if (!stale || !stale.length) return NextResponse.json({ ok: true, cancelled: 0 });

  for (const ride of stale) {
    await admin
      .from("rides")
      .update({ status: "cancelled", cancel_reason: "Auto-cancelled — no response within 24 hours" })
      .eq("id", ride.id);

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
        notes: "Ride auto-cancelled after 24 hours with no response — wallet amount refunded",
      });
    }

    // Any pending bids on an abandoned negotiation are moot — expire them
    // too so drivers aren't shown as still having a live bid out.
    await admin.from("ride_offers").update({ status: "expired" }).eq("ride_id", ride.id).eq("status", "pending");
  }

  return NextResponse.json({ ok: true, cancelled: stale.length });
}
