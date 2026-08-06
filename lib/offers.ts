import type { SupabaseClient } from "@supabase/supabase-js";

export const OFFER_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Marks any 'pending' ride_offers older than the expiry window as
 * 'expired'. There's no scheduled background job here — this is called
 * opportunistically wherever offers are loaded (the rider's negotiation
 * screen, the driver's own-bids check), so staleness gets cleaned up as a
 * natural side effect of normal app usage rather than needing a cron job.
 * Safe to call frequently; it's a no-op when nothing has actually expired.
 */
export async function expireStaleOffers(supabase: SupabaseClient, opts?: { rideId?: string; driverId?: string }) {
  const cutoff = new Date(Date.now() - OFFER_EXPIRY_MS).toISOString();
  let query = supabase.from("ride_offers").update({ status: "expired" }).eq("status", "pending").lt("created_at", cutoff);
  if (opts?.rideId) query = query.eq("ride_id", opts.rideId);
  if (opts?.driverId) query = query.eq("driver_id", opts.driverId);
  await query;
}
