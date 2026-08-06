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

  const { data: profile } = await supabase.from("profiles").select("role, is_super_admin").eq("id", user.id).single();
  if (!profile?.is_super_admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { reason } = await req.json().catch(() => ({ reason: null }));
  const admin = createAdminClient();

  const { error } = await admin
    .from("driver_subscriptions")
    .update({ status: "waived", waived_by: user.id, waived_reason: reason || "Waived by admin" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "waive_subscription",
    target_type: "driver_subscriptions",
    target_id: id,
    details: { reason },
  });

  return NextResponse.json({ ok: true });
}
