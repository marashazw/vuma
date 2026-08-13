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

  const { feeType, feeAmount, currency } = await req.json();
  if (!["monthly", "per_trip", "none"].includes(feeType)) {
    return NextResponse.json({ error: "feeType must be 'monthly', 'per_trip', or 'none'" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("vuma_private_fee_settings")
    .update({
      fee_type: feeType,
      fee_amount: Number(feeAmount) || 0,
      currency: currency || "USD",
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "update_vuma_private_fee_settings",
    target_type: "vuma_private_fee_settings",
    target_id: "singleton",
    details: { feeType, feeAmount, currency },
  });

  return NextResponse.json({ ok: true });
}
