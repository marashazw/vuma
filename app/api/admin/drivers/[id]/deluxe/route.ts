import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: driverId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, is_super_admin").eq("id", user.id).single();
  if (!profile?.is_super_admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { action, nextInspectionDue, notes } = await req.json();
  if (!["certify", "reject", "expire"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const admin = createAdminClient();
  const update: Record<string, any> = { deluxe_notes: notes || null };

  if (action === "certify") {
    update.deluxe_status = "certified";
    update.deluxe_certified_at = new Date().toISOString();
    update.deluxe_next_inspection_due = nextInspectionDue || null;
  } else if (action === "reject") {
    update.deluxe_status = "none";
  } else if (action === "expire") {
    update.deluxe_status = "expired";
  }

  const { error } = await admin.from("driver_profiles").update(update).eq("user_id", driverId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: `deluxe_${action}`,
    target_type: "driver_profiles",
    target_id: driverId,
    details: { nextInspectionDue, notes },
  });

  return NextResponse.json({ ok: true });
}
