import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { offerId } = await req.json();
  if (!offerId) return NextResponse.json({ error: "An offer ID is required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: offer } = await admin.from("vuma_private_trip_offers").select("*").eq("id", offerId).single();
  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  if (offer.status !== "offered") return NextResponse.json({ error: "This offer is no longer available" }, { status: 409 });

  const { data: request } = await admin.from("vuma_private_trip_requests").select("*").eq("id", offer.trip_request_id).single();
  if (!request) return NextResponse.json({ error: "Trip request not found" }, { status: 404 });
  if (request.requested_by !== user.id) return NextResponse.json({ error: "Only the requester can accept an offer" }, { status: 403 });
  if (request.status !== "open") return NextResponse.json({ error: "This request is no longer open" }, { status: 409 });

  const { data: profile } = await admin.from("profiles").select("role, wallet_balance, wallet_currency, country").eq("id", user.id).single();
  const { data: fee } = await admin
    .from("vuma_private_fee_settings")
    .select("fee_type, fee_amount, fee_percentage, currency")
    .eq("id", true)
    .single();

  let feeCharged = 0;

  if (fee?.fee_type === "per_trip" && Number(fee.fee_percentage) > 0) {
    feeCharged = Math.round(Number(offer.cost_per_person) * (Number(fee.fee_percentage) / 100) * 100) / 100;

    // Same wallet a rider already uses for everything else — Vuma Private
    // is role-agnostic, but a driver-role member still only ever has one
    // wallet balance worth checking here (profiles.wallet_balance),
    // separate from their prepaid commission wallet, since this fee has
    // nothing to do with ride commission at all.
    const balance = Number(profile?.wallet_balance) || 0;
    if (balance < feeCharged) {
      return NextResponse.json(
        {
          error: `Not enough wallet balance to cover the ${fee.currency} ${feeCharged.toFixed(2)} membership fee for this trip. Top up your wallet to continue.`,
          insufficientBalance: true,
          feeCharged,
        },
        { status: 402 }
      );
    }

    const newBalance = Math.round((balance - feeCharged) * 100) / 100;
    await admin.from("profiles").update({ wallet_balance: newBalance }).eq("id", user.id);

    await admin.from("wallet_transactions").insert({
      rider_id: user.id,
      type: "vuma_private_fee",
      amount: -feeCharged,
      currency: fee.currency,
      notes: `Vuma Private per-trip membership fee (${fee.fee_percentage}% of ${fee.currency} ${Number(offer.cost_per_person).toFixed(2)} cost-share)`,
    });

    await admin.from("transactions").insert({
      driver_id: profile?.role === "driver" ? user.id : null,
      rider_id: profile?.role !== "driver" ? user.id : null,
      type: "vuma_private_fee",
      amount: feeCharged,
      currency: fee.currency,
      gateway: "vuma_private",
      status: "success",
    });
  } else if (fee?.fee_type === "monthly") {
    const { data: membership } = await admin
      .from("vuma_associates_memberships")
      .select("paid_up_until")
      .eq("profile_id", user.id)
      .maybeSingle();
    const paidUp = membership?.paid_up_until && new Date(membership.paid_up_until) > new Date();
    if (!paidUp) {
      return NextResponse.json(
        {
          error: `Your Vuma Private membership needs renewing for this month before you can lock a trip. Use your wallet to renew.`,
          needsRenewal: true,
        },
        { status: 402 }
      );
    }
  }

  await admin.from("vuma_private_trip_offers").update({ status: "accepted" }).eq("id", offerId);
  await admin
    .from("vuma_private_trip_requests")
    .update({ status: "locked", accepted_offer_id: offerId })
    .eq("id", request.id);

  return NextResponse.json({ ok: true, feeCharged });
}
