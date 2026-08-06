import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { planId, referenceCode, amountClaimed, proofOfPaymentPath } = await req.json();
  const cleanReference = referenceCode ? String(referenceCode).trim() : null;

  if (!planId) return NextResponse.json({ error: "A plan is required" }, { status: 400 });
  if (!cleanReference && !proofOfPaymentPath) {
    return NextResponse.json({ error: "A reference code or a proof-of-payment upload is required" }, { status: 400 });
  }

  const { error } = await supabase.from("manual_payment_submissions").insert({
    driver_id: user.id,
    plan_id: planId,
    reference_code: cleanReference,
    proof_of_payment_path: proofOfPaymentPath || null,
    amount_claimed: amountClaimed || null,
    status: "pending",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
