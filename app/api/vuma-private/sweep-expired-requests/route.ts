import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Called opportunistically from normal app usage (via RideSweepTrigger,
 * mounted at the rider/driver layout level), same no-cron-job pattern as
 * the other sweep routes in this app.
 *
 * Expiry is anchored to the request's own needed_at, not its created_at —
 * "auto-expire after 24 hours, unless the request is for a date and time
 * ahead" specifically means a request posted today for next Saturday
 * should stay visible in feeds right up until next Saturday, not vanish
 * after 24 hours of simply being open. The 24-hour grace period applies
 * *after* needed_at has already passed, giving a little room for
 * last-minute coordination past the exact requested time before the
 * request is considered genuinely stale.
 */
const GRACE_MS = 24 * 60 * 60 * 1000;

export async function POST() {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - GRACE_MS).toISOString();

  const { data: expired } = await admin
    .from("vuma_private_trip_requests")
    .select("id")
    .eq("status", "open")
    .lt("needed_at", cutoff);

  if (expired?.length) {
    await admin
      .from("vuma_private_trip_requests")
      .update({ status: "cancelled" })
      .in(
        "id",
        expired.map((r) => r.id)
      );
  }

  return NextResponse.json({ ok: true, swept: expired?.length || 0 });
}
