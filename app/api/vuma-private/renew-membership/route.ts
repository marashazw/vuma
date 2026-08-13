import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("vuma_associates_memberships")
    .select("id, status, paid_up_until")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!membership || membership.status !== "active") {
    return NextResponse.json({ error: "An active Vuma Private membership is required to renew" }, { status: 403 });
  }

  const { data: fee } = await admin.from("vuma_private_fee_settings").select("fee_type, fee_amount, currency").eq("id", true).single();
  if (fee?.fee_type !== "monthly" || Number(fee.fee_amount) <= 0) {
    return NextResponse.json({ error: "There's no monthly fee currently configured" }, { status: 400 });
  }

  const { data: profile } = await admin.from("profiles").select("wallet_balance").eq("id", user.id).single();
  const balance = Number(profile?.wallet_balance) || 0;
  const feeAmount = Number(fee.fee_amount);

  if (balance < feeAmount) {
    return NextResponse.json(
      { error: `Not enough wallet balance to renew — need ${fee.currency} ${feeAmount.toFixed(2)}. Top up your wallet first.` },
      { status: 402 }
    );
  }

  const newBalance = Math.round((balance - feeAmount) * 100) / 100;
  await admin.from("profiles").update({ wallet_balance: newBalance }).eq("id", user.id);

  // Extends from whichever is later — today, or the current paid-up date
  // if they're renewing early rather than after lapsing — so renewing
  // early never shortens time already paid for.
  const base = membership.paid_up_until && new Date(membership.paid_up_until) > new Date() ? new Date(membership.paid_up_until) : new Date();
  const newPaidUpUntil = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await admin.from("vuma_associates_memberships").update({ paid_up_until: newPaidUpUntil }).eq("id", membership.id);

  await admin.from("wallet_transactions").insert({
    rider_id: user.id,
    type: "vuma_private_fee",
    amount: -feeAmount,
    currency: fee.currency,
    notes: "Vuma Private monthly membership fee",
  });

  await admin.from("transactions").insert({
    rider_id: user.id,
    type: "vuma_private_fee",
    amount: feeAmount,
    currency: fee.currency,
    gateway: "vuma_private",
    status: "success",
  });

  return NextResponse.json({ ok: true, paidUpUntil: newPaidUpUntil });
}
