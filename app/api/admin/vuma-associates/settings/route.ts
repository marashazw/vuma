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

  const { requireMembershipForDriverRegistration } = await req.json();
  const admin = createAdminClient();

  const { error } = await admin
    .from("vuma_associates_settings")
    .update({
      require_membership_for_driver_registration: !!requireMembershipForDriverRegistration,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "update_vuma_associates_settings",
    target_type: "vuma_associates_settings",
    target_id: "singleton",
    details: { requireMembershipForDriverRegistration },
  });

  return NextResponse.json({ ok: true });
}
