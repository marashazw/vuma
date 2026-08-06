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

  const { country, default_pct } = await req.json();
  const admin = createAdminClient();

  const { error } = await admin
    .from("commission_settings")
    .update({ default_pct, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("country", country);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "update_commission_default",
    target_type: "commission_settings",
    target_id: country,
    details: { default_pct },
  });

  return NextResponse.json({ ok: true });
}
