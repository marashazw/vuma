import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single();
  if (!profile?.is_super_admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const admin = createAdminClient();
  const { data: charge } = await admin.from("charge_types").select("is_active").eq("id", id).single();
  if (!charge) return NextResponse.json({ error: "Charge not found" }, { status: 404 });

  const { error } = await admin
    .from("charge_types")
    .update({ is_active: !charge.is_active, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: charge.is_active ? "deactivate_charge_type" : "activate_charge_type",
    target_type: "charge_types",
    target_id: id,
  });

  return NextResponse.json({ ok: true, isActive: !charge.is_active });
}
