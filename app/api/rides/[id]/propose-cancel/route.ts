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

  const { reason } = await req.json().catch(() => ({ reason: null }));
  if (!reason || !reason.trim()) return NextResponse.json({ error: "A reason is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: ride } = await admin
    .from("rides")
    .select("rider_id, driver_id, status, is_scheduled, scheduled_cancel_status")
    .eq("id", id)
    .single();
  if (!ride) return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  if (ride.rider_id !== user.id && ride.driver_id !== user.id) {
    return NextResponse.json({ error: "Not part of this ride" }, { status: 403 });
  }
  if (!ride.is_scheduled || ride.status !== "accepted") {
    return NextResponse.json({ error: "This is only for an accepted scheduled ride" }, { status: 409 });
  }
  if (ride.scheduled_cancel_status === "proposed") {
    return NextResponse.json({ error: "A cancellation is already pending on this ride" }, { status: 409 });
  }

  const { error } = await admin
    .from("rides")
    .update({ scheduled_cancel_status: "proposed", scheduled_cancel_proposed_by: user.id, scheduled_cancel_reason: reason.trim() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
