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

  const { planId, durationDays, claimWindowStartsAt, claimWindowEndsAt, note } = await req.json();
  if (!planId || !durationDays || durationDays <= 0) {
    return NextResponse.json({ error: "A plan and a positive duration in days are both required" }, { status: 400 });
  }
  if (!claimWindowStartsAt || !claimWindowEndsAt || new Date(claimWindowEndsAt) <= new Date(claimWindowStartsAt)) {
    return NextResponse.json({ error: "A valid claim window is required, with an end after the start" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: plan } = await admin.from("subscription_plans").select("id").eq("id", planId).single();
  if (!plan) return NextResponse.json({ error: "That plan doesn't exist" }, { status: 400 });

  const { data, error } = await admin
    .from("subscription_holiday_offers")
    .insert({
      plan_id: planId,
      duration_days: durationDays,
      claim_window_starts_at: claimWindowStartsAt,
      claim_window_ends_at: claimWindowEndsAt,
      note: note || null,
      is_active: true,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "create_subscription_holiday_offer",
    target_type: "subscription_holiday_offers",
    target_id: data.id,
    details: { planId, durationDays, claimWindowStartsAt, claimWindowEndsAt },
  });

  return NextResponse.json({ ok: true, offer: data });
}
