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
  const { data: topup } = await admin.from("driver_wallet_topups").select("*").eq("id", id).single();
  if (!topup) return NextResponse.json({ error: "Top-up request not found" }, { status: 404 });
  if (topup.status !== "pending") {
    return NextResponse.json({ error: "This request has already been reviewed" }, { status: 409 });
  }

  const { data: driverProfile } = await admin
    .from("driver_profiles")
    .select("prepaid_wallet_balance")
    .eq("user_id", topup.driver_id)
    .single();
  const newBalance = Math.round((Number(driverProfile?.prepaid_wallet_balance || 0) + Number(topup.amount)) * 100) / 100;

  await admin.from("driver_profiles").update({ prepaid_wallet_balance: newBalance }).eq("user_id", topup.driver_id);
  await admin.from("driver_wallet_transactions").insert({
    driver_id: topup.driver_id,
    type: "topup",
    amount: Number(topup.amount),
    balance_after: newBalance,
    notes: topup.reference_code ? `Top-up approved (ref: ${topup.reference_code})` : "Top-up approved",
  });

  await admin
    .from("driver_wallet_topups")
    .update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "approve_wallet_topup",
    target_type: "driver_wallet_topups",
    target_id: id,
    details: { amount: topup.amount, new_balance: newBalance },
  });

  return NextResponse.json({ ok: true, newBalance });
}
