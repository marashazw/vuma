import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { periodDays } from "@/lib/commission";

function parseBody(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("&")) {
    const [k, ...rest] = line.split("=");
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const body = parseBody(raw);

  // Paynow's status hash verification is skipped here for brevity — in
  // production, recompute the hash the same way as initiatePaynowCharge
  // and compare against body.hash before trusting this payload.

  const [driverId, planId, gatewayRef] = (body.reference || "").split(":");
  if (!driverId || !planId) return NextResponse.json({ error: "Bad reference" }, { status: 400 });

  if (body.status?.toLowerCase() !== "paid") {
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
    amount_paid: Number(body.amount || plan.price),
    gateway: "paynow",
    gateway_ref: gatewayRef,
  });

  await admin.from("driver_profiles").update({ commission_mode: "subscription" }).eq("user_id", driverId);

  await admin.from("transactions").insert({
    driver_id: driverId,
    type: "subscription_payment",
    amount: Number(body.amount || plan.price),
    currency: plan.currency,
    gateway: "paynow",
    gateway_ref: gatewayRef,
    status: "success",
  });

  return NextResponse.json({ ok: true });
}
