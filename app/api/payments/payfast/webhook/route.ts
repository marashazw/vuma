import { NextRequest, NextResponse } from "next/server";
import { verifyPayfastItn } from "@/lib/payments/payfast";
import { createAdminClient } from "@/lib/supabase/admin";
import { periodDays } from "@/lib/commission";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const body: Record<string, string> = Object.fromEntries(new URLSearchParams(raw));

  if (!verifyPayfastItn(body)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // m_payment_id carries our reference: `${driverId}:${planId}:${gatewayRef}`
  const [driverId, planId, gatewayRef] = (body.m_payment_id || "").split(":");
  if (!driverId || !planId) return NextResponse.json({ error: "Bad reference" }, { status: 400 });

  if (body.payment_status !== "COMPLETE") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const admin = createAdminClient();
  const { data: plan } = await admin.from("subscription_plans").select("*").eq("id", planId).single();
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const now = new Date();
  const ends = new Date(now.getTime() + periodDays(plan.period) * 86400000);

  await admin.from("driver_subscriptions").insert({
    driver_id: driverId,
    plan_id: planId,
    status: "active",
    starts_at: now.toISOString(),
    ends_at: ends.toISOString(),
    amount_paid: Number(body.amount_gross || plan.price),
    gateway: "payfast",
    gateway_ref: gatewayRef,
  });

  await admin.from("driver_profiles").update({ commission_mode: "subscription" }).eq("user_id", driverId);

  await admin.from("transactions").insert({
    driver_id: driverId,
    type: "subscription_payment",
    amount: Number(body.amount_gross || plan.price),
    currency: plan.currency,
    gateway: "payfast",
    gateway_ref: gatewayRef,
    status: "success",
  });

  return NextResponse.json({ ok: true });
}
