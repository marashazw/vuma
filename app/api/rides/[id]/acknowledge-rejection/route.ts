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

  const admin = createAdminClient();
  const { data: ride } = await admin
    .from("rides")
    .select("rider_id, driver_id, scheduled_cancel_status, scheduled_cancel_proposed_by")
    .eq("id", id)
    .single();
  if (!ride) return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  if (ride.rider_id !== user.id && ride.driver_id !== user.id) {
    return NextResponse.json({ error: "Not part of this ride" }, { status: 403 });
  }
  if (ride.scheduled_cancel_status !== "rejected" || ride.scheduled_cancel_proposed_by !== user.id) {
    return NextResponse.json({ error: "There's no rejected proposal of yours to acknowledge" }, { status: 409 });
  }

  await admin
    .from("rides")
    .update({ scheduled_cancel_status: "none", scheduled_cancel_proposed_by: null, scheduled_cancel_reason: null })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
