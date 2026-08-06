import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { activateDriverSubscription } from "@/lib/subscriptions";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, is_super_admin").eq("id", user.id).single();
  if (!profile?.is_super_admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const admin = createAdminClient();
  const { data: submission } = await admin.from("manual_payment_submissions").select("*").eq("id", id).single();
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  if (submission.status !== "pending") {
    return NextResponse.json({ error: "This submission has already been reviewed" }, { status: 409 });
  }

  const { data: plan } = await admin.from("subscription_plans").select("*").eq("id", submission.plan_id).single();
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  try {
    await activateDriverSubscription(admin, {
      driverId: submission.driver_id,
      planId: submission.plan_id,
      amountPaid: submission.amount_claimed || plan.price,
      gateway: "manual",
      gatewayRef: submission.reference_code,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not activate subscription" }, { status: 500 });
  }

  await admin
    .from("manual_payment_submissions")
    .update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "approve_manual_payment",
    target_type: "manual_payment_submissions",
    target_id: id,
    details: { reference_code: submission.reference_code },
  });

  return NextResponse.json({ ok: true });
}
