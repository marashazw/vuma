import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPayfastCharge } from "@/lib/payments/payfast";
import { initiatePaynowCharge } from "@/lib/payments/paynow";
import { periodDays } from "@/lib/commission";
import { randomUUID } from "crypto";

const isMock = process.env.PAYMENTS_MOCK_MODE === "true";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = user.id;

  const { planId, gateway, ecocashPhone } = await req.json();

  const admin = createAdminClient();
  const { data: plan } = await admin.from("subscription_plans").select("*").eq("id", planId).single();
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const { data: profile } = await admin.from("profiles").select("*").eq("id", userId).single();

  const gatewayRef = randomUUID();
  const reference = `${userId}:${planId}:${gatewayRef}`;

  async function activateSubscription(amountPaid: number, gw: string) {
    const now = new Date();
    const ends = new Date(now.getTime() + periodDays(plan.period) * 86400000);
    await admin.from("driver_subscriptions").insert({
      driver_id: userId,
      plan_id: planId,
      status: "active",
      starts_at: now.toISOString(),
      ends_at: ends.toISOString(),
      amount_paid: amountPaid,
      gateway: gw,
      gateway_ref: gatewayRef,
    });
    await admin.from("driver_profiles").update({ commission_mode: "subscription" }).eq("user_id", userId);
    await admin.from("transactions").insert({
      driver_id: userId,
      type: "subscription_payment",
      amount: amountPaid,
      currency: plan.currency,
      gateway: gw,
      gateway_ref: gatewayRef,
      status: "success",
    });
  }

  if (isMock) {
    await activateSubscription(plan.price, "mock");
    return NextResponse.json({ mock: true, redirectUrl: "/driver/subscription?success=1" });
  }

  if (gateway === "payfast") {
    const charge = buildPayfastCharge({
      amount: plan.price,
      itemName: `Vuma driver subscription — ${plan.name}`,
      reference,
      returnUrl: `${APP_URL}/driver/subscription?success=1`,
      cancelUrl: `${APP_URL}/driver/subscription?cancelled=1`,
      notifyUrl: `${APP_URL}/api/payments/payfast/webhook`,
      buyerEmail: profile?.email || undefined,
      buyerFirstName: profile?.full_name,
    });
    return NextResponse.json(charge);
  }

  if (gateway === "paynow") {
    const result = await initiatePaynowCharge({
      amount: plan.price,
      reference,
      buyerEmail: profile?.email || "driver@vuma.app",
      resultUrl: `${APP_URL}/api/payments/paynow/webhook`,
      returnUrl: `${APP_URL}/driver/subscription?success=1`,
      ecocashPhone,
    });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown gateway" }, { status: 400 });
}
