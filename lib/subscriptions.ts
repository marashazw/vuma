import { createAdminClient } from "@/lib/supabase/admin";
import { periodDays } from "@/lib/commission";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function activateDriverSubscription(
  admin: AdminClient,
  params: { driverId: string; planId: string; amountPaid: number; gateway: string; gatewayRef?: string | null }
) {
  const { data: plan } = await admin.from("subscription_plans").select("*").eq("id", params.planId).single();
  if (!plan) throw new Error("Plan not found");

  const now = new Date();
  const ends = new Date(now.getTime() + periodDays(plan.period) * 86400000);

  await admin.from("driver_subscriptions").insert({
    driver_id: params.driverId,
    plan_id: params.planId,
    status: "active",
    starts_at: now.toISOString(),
    ends_at: ends.toISOString(),
    amount_paid: params.amountPaid,
    gateway: params.gateway,
    gateway_ref: params.gatewayRef || null,
  });

  await admin.from("driver_profiles").update({ commission_mode: "subscription" }).eq("user_id", params.driverId);

  await admin.from("transactions").insert({
    driver_id: params.driverId,
    type: "subscription_payment",
    amount: params.amountPaid,
    currency: plan.currency,
    gateway: params.gateway,
    gateway_ref: params.gatewayRef || null,
    status: "success",
  });

  return plan;
}
