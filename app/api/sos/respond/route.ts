import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_STATUSES = ["acknowledged", "notified_police", "attending", "arrived"];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { responseId, status, policeReference, notes } = await req.json();
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data: response } = await supabase.from("sos_responses").select("*").eq("id", responseId).single();
  if (!response) return NextResponse.json({ error: "Response not found" }, { status: 404 });
  if (response.driver_id !== user.id) {
    return NextResponse.json({ error: "Not your notification" }, { status: 403 });
  }

  const { error } = await supabase
    .from("sos_responses")
    .update({
      status,
      police_reference: policeReference || null,
      notes: notes || null,
      responded_at: new Date().toISOString(),
    })
    .eq("id", responseId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
