import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rideId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { offerId } = await req.json();
  if (!offerId) return NextResponse.json({ error: "An offer ID is required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: ride } = await admin.from("rides").select("*").eq("id", rideId).single();
  if (!ride) return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  if (ride.rider_id !== user.id) {
    console.error("[accept-offer] rider mismatch:", { sessionUserId: user.id, rideRiderId: ride.rider_id, rideId });
    return NextResponse.json(
      {
        error: "Only this ride's rider can accept an offer",
        debug: { sessionUserId: user.id, rideRiderId: ride.rider_id },
      },
      { status: 403 }
    );
  }

  const { data: offer } = await admin.from("ride_offers").select("*").eq("id", offerId).eq("ride_id", rideId).single();
  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  if (offer.status !== "pending" && offer.status !== "countered") {
    return NextResponse.json({ error: "This offer is no longer available" }, { status: 409 });
  }

  const offerAgeMs = Date.now() - new Date(offer.created_at).getTime();
  if (offerAgeMs > 60 * 60 * 1000) {
    await admin.from("ride_offers").update({ status: "expired" }).eq("id", offerId);
    return NextResponse.json({ error: "This offer has expired — ask the driver to submit a new one" }, { status: 409 });
  }

  const { error: offerErr } = await admin.from("ride_offers").update({ status: "accepted" }).eq("id", offerId);
  if (offerErr) return NextResponse.json({ error: offerErr.message }, { status: 500 });

  const { error: rideErr } = await admin
    .from("rides")
    .update({
      driver_id: offer.driver_id,
      final_fare: offer.amount,
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", rideId);
  if (rideErr) return NextResponse.json({ error: rideErr.message }, { status: 500 });

  // Reject this driver's other offers on the SAME ride.
  await admin.from("ride_offers").update({ status: "rejected" }).eq("ride_id", rideId).neq("id", offerId);

  // The driver is now committed to this ride — withdraw any other PENDING
  // bids they'd placed on other open requests, since they've been
  // overtaken by events and the driver can no longer fulfill them.
  const { error: withdrawErr } = await admin
    .from("ride_offers")
    .update({ status: "withdrawn" })
    .eq("driver_id", offer.driver_id)
    .eq("status", "pending")
    .neq("ride_id", rideId);
  if (withdrawErr) {
    console.error("[accept-offer] failed to withdraw driver's other pending bids (non-fatal):", withdrawErr);
  }

  return NextResponse.json({ ok: true });
}
