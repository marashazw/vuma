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

  const { name, rate, flat_amount } = await req.json();
  const admin = createAdminClient();

  const { data: charge } = await admin.from("charge_types").select("charge_kind").eq("id", id).single();
  if (!charge) return NextResponse.json({ error: "Charge not found" }, { status: 404 });

  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  if (name?.trim()) update.name = name.trim();
  if (charge.charge_kind === "percentage" && rate !== undefined) update.rate = rate;
  if (charge.charge_kind === "flat" && flat_amount !== undefined) update.flat_amount = flat_amount;

  const { error } = await admin.from("charge_types").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "update_charge_type",
    target_type: "charge_types",
    target_id: id,
    details: update,
  });

  return NextResponse.json({ ok: true });
}
