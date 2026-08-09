import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { driverIds } = await req.json();
  if (!Array.isArray(driverIds) || !driverIds.length) {
    return NextResponse.json({ drivers: [] });
  }

  const admin = createAdminClient();

  // Deliberately re-verify online + verified here rather than trusting
  // the caller's list — this keeps the endpoint from being usable as a
  // general "look up any user's name/photo" tool by only ever returning
  // data for drivers who are currently, genuinely part of the public
  // fleet (the same "public fleet visibility is required for matching"
  // reasoning driver_profiles' own select policy already relies on).
  const { data: onlineDrivers } = await admin
    .from("driver_profiles")
    .select("user_id")
    .in("user_id", driverIds)
    .eq("is_online", true)
    .eq("verification_status", "verified");
  const validIds = (onlineDrivers || []).map((d) => d.user_id);

  const { data: profiles } = await admin.from("profiles").select("id, full_name, avatar_url").in("id", validIds.length ? validIds : ["-"]);

  return NextResponse.json({ drivers: profiles || [] });
}
