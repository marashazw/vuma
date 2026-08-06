import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, is_super_admin").eq("id", user.id).single();
  if (!profile?.is_super_admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { responseId, freeRides = 1, priorityDays = 14, badge = "sos_responder" } = await req.json();
  const admin = createAdminClient();

  const { data: response } = await admin.from("sos_responses").select("*").eq("id", responseId).single();
  if (!response) return NextResponse.json({ error: "Response not found" }, { status: 404 });

  const { data: driverProfile } = await admin
    .from("driver_profiles")
    .select("*")
    .eq("user_id", response.driver_id)
    .single();

  const currentPriority = driverProfile?.priority_until ? new Date(driverProfile.priority_until) : new Date();
  const base = currentPriority > new Date() ? currentPriority : new Date();
  const newPriority = new Date(base.getTime() + priorityDays * 86400000).toISOString();

  const badges: string[] = Array.isArray(driverProfile?.badges) ? driverProfile.badges : [];
  const nextBadges = badge && !badges.includes(badge) ? [...badges, badge] : badges;

  await admin
    .from("driver_profiles")
    .update({
      free_ride_credits: (driverProfile?.free_ride_credits || 0) + freeRides,
      priority_until: newPriority,
      badges: nextBadges,
    })
    .eq("user_id", response.driver_id);

  await admin
    .from("sos_responses")
    .update({ rewarded: true, reward_type: `${freeRides} free rides + ${priorityDays}d priority` })
    .eq("id", responseId);

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "reward_sos_response",
    target_type: "sos_responses",
    target_id: responseId,
    details: { freeRides, priorityDays, badge },
  });

  return NextResponse.json({ ok: true });
}
