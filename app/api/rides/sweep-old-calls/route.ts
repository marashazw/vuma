import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Same opportunistic, no-cron-job pattern as the other sweep routes in
 * this app, fired from RideSweepTrigger.
 */
export async function POST() {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: deleted } = await admin.from("ride_calls").delete().lt("started_at", cutoff).select("id");

  return NextResponse.json({ ok: true, swept: deleted?.length || 0 });
}
