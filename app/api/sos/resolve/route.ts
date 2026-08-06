import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { alertId, status, notes } = await req.json();
  const finalStatus = status === "false_alarm" ? "false_alarm" : "resolved";

  const { data: alert } = await supabase.from("sos_alerts").select("triggered_by").eq("id", alertId).single();
  if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });

  const { data: profile } = await supabase.from("profiles").select("role, is_super_admin").eq("id", user.id).single();
  if (alert.triggered_by !== user.id && !profile?.is_super_admin) {
    return NextResponse.json({ error: "Not authorized to resolve this alert" }, { status: 403 });
  }

  const { error } = await supabase
    .from("sos_alerts")
    .update({ status: finalStatus, resolved_at: new Date().toISOString(), resolved_by: user.id, notes: notes || null })
    .eq("id", alertId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
