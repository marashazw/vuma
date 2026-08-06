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
  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: "Only super-admins can switch views" }, { status: 403 });
  }

  const { role } = await req.json();
  if (!["admin", "driver", "rider"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (role === "driver") {
    // First time switching to driver — auto-provision a driver_profiles row
    // and pre-verify it, since this is a trusted super-admin testing the
    // experience, not a real driver going through onboarding.
    const { data: existing } = await admin.from("driver_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!existing) {
      await admin.from("driver_profiles").insert({
        user_id: user.id,
        verification_status: "verified",
      });
    }
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "switch_role",
    target_type: "profiles",
    target_id: user.id,
    details: { switched_to: role },
  });

  return NextResponse.json({ ok: true });
}
