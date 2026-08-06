import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role, is_super_admin").eq("id", user.id).single();
  return profile?.is_super_admin ? user : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json();
  const allowed: Record<string, any> = {};
  if ("verification_status" in body) allowed.verification_status = body.verification_status;
  if ("commission_override_pct" in body) allowed.commission_override_pct = body.commission_override_pct;
  if ("commission_mode" in body) allowed.commission_mode = body.commission_mode;
  if ("rejection_reason" in body) allowed.rejection_reason = body.rejection_reason;

  const client = createAdminClient();
  const { error } = await client.from("driver_profiles").update(allowed).eq("user_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await client.from("admin_audit_log").insert({
    admin_id: admin.id,
    action: "update_driver_profile",
    target_type: "driver_profiles",
    target_id: id,
    details: allowed,
  });

  return NextResponse.json({ ok: true });
}
