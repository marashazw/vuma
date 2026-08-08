import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { accept } = await req.json();

  const admin = createAdminClient();
  const { data: ride } = await admin
    .from("rides")
    .select(
      "rider_id, driver_id, status, scheduled_cancel_status, scheduled_cancel_proposed_by, applied_credit_id, wallet_applied, currency, commission_reserved"
    )
    .eq("id", id)
    .single();
  if (!ride) return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  if (ride.rider_id !== user.id && ride.driver_id !== user.id) {
    return NextResponse.json({ error: "Not part of this ride" }, { status: 403 });
  }
  if (ride.scheduled_cancel_status !== "proposed") {
    return NextResponse.json({ error: "No pending cancellation to respond to" }, { status: 409 });
  }
  if (ride.scheduled_cancel_proposed_by === user.id) {
    return NextResponse.json({ error: "You can't respond to your own proposal" }, { status: 403 });
  }

  if (!accept) {
    await admin
      .from("rides")
      .update({ scheduled_cancel_status: "rejected", scheduled_cancel_proposed_by: null, scheduled_cancel_reason: null })
      .eq("id", id);
    return NextResponse.json({ ok: true, accepted: false });
  }

  await admin
    .from("rides")
    .update({
      status: "cancelled",
      cancel_reason: "Mutually agreed cancellation",
      cancelled_by: user.id,
      scheduled_cancel_status: "accepted",
    })
    .eq("id", id);

  if (ride.commission_reserved && ride.driver_id) {
    const { data: driverProfile } = await admin
      .from("driver_profiles")
      .select("reserved_balance")
      .eq("user_id", ride.driver_id)
      .single();
    const newReserved = Math.max(Number(driverProfile?.reserved_balance || 0) - Number(ride.commission_reserved), 0);
    await admin.from("driver_profiles").update({ reserved_balance: newReserved }).eq("user_id", ride.driver_id);
  }

  if (ride.applied_credit_id) {
    await admin.from("ride_credits").update({ status: "available", used_ride_id: null }).eq("id", ride.applied_credit_id);
  }
  if (Number(ride.wallet_applied) > 0) {
    const { data: riderProfile } = await admin.from("profiles").select("wallet_balance").eq("id", ride.rider_id).single();
    await admin
      .from("profiles")
      .update({ wallet_balance: Number(riderProfile?.wallet_balance || 0) + Number(ride.wallet_applied) })
      .eq("id", ride.rider_id);
    await admin.from("wallet_transactions").insert({
      rider_id: ride.rider_id,
      ride_id: id,
      type: "refunded",
      amount: Number(ride.wallet_applied),
      currency: ride.currency,
      notes: "Ride mutually cancelled — wallet amount refunded",
    });
  }

  return NextResponse.json({ ok: true, accepted: true });
}
