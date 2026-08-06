import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { activateDriverSubscription } from "@/lib/subscriptions";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { planId } = await req.json();
  const admin = createAdminClient();

  const { data: plan } = await admin.from("subscription_plans").select("*").eq("id", planId).single();
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const { data: driverProfile } = await admin.from("driver_profiles").select("credit_balance").eq("user_id", user.id).single();
  const balance = Number(driverProfile?.credit_balance || 0);

  if (balance < plan.price) {
    return NextResponse.json(
      { error: `You need ${plan.currency}${plan.price} of credit balance, you have ${plan.currency}${balance.toFixed(2)}.` },
      { status: 400 }
    );
  }

  try {
    await activateDriverSubscription(admin, {
      driverId: user.id,
      planId,
      amountPaid: plan.price,
      gateway: "credit_balance",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not activate subscription" }, { status: 500 });
  }

  await admin
    .from("driver_profiles")
    .update({ credit_balance: balance - plan.price })
    .eq("user_id", user.id);

  await admin.from("driver_credit_transactions").insert({
    driver_id: user.id,
    type: "spent_subscription",
    amount: -plan.price,
    currency: plan.currency,
    notes: `Applied toward ${plan.name}`,
  });

  return NextResponse.json({ ok: true });
}
