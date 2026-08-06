import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { periodDays } from "@/lib/commission";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, is_super_admin").eq("id", user.id).single();
  if (!profile?.is_super_admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { driverId, planId } = await req.json();
  const admin = createAdminClient();

  const { data: plan } = await admin.from("subscription_plans").select("*").eq("id", planId).single();
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const now = new Date();
  const ends = new Date(now.getTime() + periodDays(plan.period) * 86400000);

  const { error } = await admin.from("driver_subscriptions").insert({
    driver_id: driverId,
    plan_id: planId,
    status: "waived",
    starts_at: now.toISOString(),
    ends_at: ends.toISOString(),
    amount_paid: 0,
    waived_by: user.id,
    waived_reason: "Granted directly by admin",
    gateway: "admin_grant",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("driver_profiles").update({ commission_mode: "subscription" }).eq("user_id", driverId);

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "grant_subscription",
    target_type: "driver_subscriptions",
    target_id: driverId,
    details: { planId },
  });

  return NextResponse.json({ ok: true });
}
