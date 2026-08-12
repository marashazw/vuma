import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single();
  if (!profile?.is_super_admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { scope, startsAt, endsAt, note } = await req.json();
  if (scope !== "deluxe_only" && scope !== "all_rides") {
    return NextResponse.json({ error: "scope must be 'deluxe_only' or 'all_rides'" }, { status: 400 });
  }
  if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
    return NextResponse.json({ error: "A valid start and end time are required, with end after start" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ride_access_restrictions")
    .insert({ scope, starts_at: startsAt, ends_at: endsAt, note: note || null, is_active: true, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "create_ride_access_restriction",
    target_type: "ride_access_restrictions",
    target_id: data.id,
    details: { scope, startsAt, endsAt },
  });

  return NextResponse.json({ ok: true, restriction: data });
}
