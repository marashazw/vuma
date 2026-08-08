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

  const { profileId, role } = await req.json();
  if (!profileId || !role) return NextResponse.json({ error: "profileId and role are both required" }, { status: 400 });
  if (role !== "rider" && role !== "driver") {
    return NextResponse.json({ error: "role must be 'rider' or 'driver'" }, { status: 400 });
  }

  const admin = createAdminClient();
  const table = role === "driver" ? "driver_profiles" : "profiles";
  const idColumn = role === "driver" ? "user_id" : "id";

  const { error } = await admin.from(table).update({ suspended_until: null, suspension_reason: null }).eq(idColumn, profileId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "manual_unfreeze",
    target_type: table,
    target_id: profileId,
    details: { role },
  });

  return NextResponse.json({ ok: true });
}
