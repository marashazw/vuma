import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

function startOfMonthUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

const CATEGORY_MAP: Record<string, { column: string; value: string }> = {
  rude: { column: "tag_politeness", value: "rude" },
  very_late: { column: "tag_punctuality", value: "very_late" },
  dirty: { column: "tag_cleanliness", value: "dirty" },
};

/**
 * Counts this driver's adverse tags of one category for the current
 * calendar month. At 5+, issues one warning for that month (at most one
 * warning per driver/category/month — a unique index also enforces this at
 * the database level). The 3rd warning for the same category automatically
 * suspends the driver for 7 days.
 */
async function checkAndEscalate(admin: AdminClient, driverId: string, category: keyof typeof CATEGORY_MAP) {
  const { column, value } = CATEGORY_MAP[category];
  const monthStart = startOfMonthUTC();

  const { count } = await admin
    .from("ratings")
    .select("id", { count: "exact", head: true })
    .eq("to_user_id", driverId)
    .eq(column, value)
    .gte("created_at", monthStart);

  if ((count || 0) < 5) return;

  const { data: existingWarning } = await admin
    .from("driver_warnings")
    .select("id")
    .eq("driver_id", driverId)
    .eq("category", category)
    .eq("period_start", monthStart)
    .maybeSingle();
  if (existingWarning) return; // already warned for this exact monthly cycle

  const { count: priorWarnings } = await admin
    .from("driver_warnings")
    .select("id", { count: "exact", head: true })
    .eq("driver_id", driverId)
    .eq("category", category);
  const warningNumber = (priorWarnings || 0) + 1;

  await admin.from("driver_warnings").insert({
    driver_id: driverId,
    category,
    warning_number: warningNumber,
    triggered_by_count: count,
    period_start: monthStart,
  });

  if (warningNumber >= 3) {
    const suspendedUntil = new Date(Date.now() + 7 * 86400000).toISOString();
    await admin
      .from("driver_profiles")
      .update({
        suspended_until: suspendedUntil,
        suspension_reason: `Repeated "${category.replace("_", " ")}" complaints from riders — 3rd warning, automatic 7-day suspension.`,
      })
      .eq("user_id", driverId);
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { rideId, stars, tagPoliteness, tagPunctuality, tagCleanliness, comment } = await req.json();
  if (!rideId || !stars) return NextResponse.json({ error: "A ride and star rating are required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: ride } = await admin.from("rides").select("*").eq("id", rideId).single();
  if (!ride) return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  if (ride.rider_id !== user.id) {
    return NextResponse.json({ error: "Only this ride's rider can rate the driver" }, { status: 403 });
  }
  if (!ride.driver_id) return NextResponse.json({ error: "No driver on this ride" }, { status: 409 });

  const { error: insertErr } = await admin.from("ratings").insert({
    ride_id: rideId,
    from_user_id: user.id,
    to_user_id: ride.driver_id,
    stars,
    comment: comment || null,
    tag_politeness: tagPoliteness || null,
    tag_punctuality: tagPunctuality || null,
    tag_cleanliness: tagCleanliness || null,
  });
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Update the driver's running rating average.
  const { data: allRatings } = await admin.from("ratings").select("stars").eq("to_user_id", ride.driver_id);
  if (allRatings && allRatings.length) {
    const avg = allRatings.reduce((s, r) => s + r.stars, 0) / allRatings.length;
    await admin
      .from("driver_profiles")
      .update({ rating_avg: Math.round(avg * 100) / 100, rating_count: allRatings.length })
      .eq("user_id", ride.driver_id);
  }

  if (tagPoliteness === "rude") await checkAndEscalate(admin, ride.driver_id, "rude");
  if (tagPunctuality === "very_late") await checkAndEscalate(admin, ride.driver_id, "very_late");
  if (tagCleanliness === "dirty") await checkAndEscalate(admin, ride.driver_id, "dirty");

  return NextResponse.json({ ok: true });
}
