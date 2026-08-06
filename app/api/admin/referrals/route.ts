import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, is_super_admin").eq("id", user.id).single();
  if (!profile?.is_super_admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { country, required_referrals, credit_amount, driver_priority_days, is_active } = await req.json();
  const admin = createAdminClient();

  const { error } = await admin
    .from("referral_settings")
    .update({
      required_referrals,
      credit_amount,
      driver_priority_days,
      is_active,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("country", country);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "update_referral_settings",
    target_type: "referral_settings",
    target_id: country,
    details: { required_referrals, credit_amount, driver_priority_days, is_active },
  });

  return NextResponse.json({ ok: true });
}
