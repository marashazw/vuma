import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { alertId } = await req.json();
  if (!alertId) return NextResponse.json({ error: "An alert ID is required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: alert } = await admin.from("sos_alerts").select("id, triggered_by").eq("id", alertId).single();
  if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });

  // Allowed for the person who triggered the alert, OR any driver who was
  // notified about it (they might be the one calling security in on it).
  const isTriggeringUser = alert.triggered_by === user.id;
  let isNotifiedDriver = false;
  if (!isTriggeringUser) {
    const { data: response } = await admin
      .from("sos_responses")
      .select("id")
      .eq("sos_alert_id", alertId)
      .eq("driver_id", user.id)
      .maybeSingle();
    isNotifiedDriver = !!response;
  }
  if (!isTriggeringUser && !isNotifiedDriver) {
    return NextResponse.json({ error: "Not authorized for this alert" }, { status: 403 });
  }

  const { error } = await admin
    .from("sos_alerts")
    .update({ security_provider_notified: true, security_provider_notified_at: new Date().toISOString() })
    .eq("id", alertId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
