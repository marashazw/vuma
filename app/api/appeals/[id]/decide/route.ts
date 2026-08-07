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

  const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single();
  if (!profile?.is_super_admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { approve, adminNotes } = await req.json();

  const admin = createAdminClient();
  const { data: appeal } = await admin.from("suspension_appeals").select("*").eq("id", id).single();
  if (!appeal) return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
  if (appeal.status !== "pending") {
    return NextResponse.json({ error: "This appeal has already been reviewed" }, { status: 409 });
  }

  await admin
    .from("suspension_appeals")
    .update({
      status: approve ? "approved" : "rejected",
      admin_notes: adminNotes || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  // Approving an appeal lifts the suspension immediately — admin retains
  // final discretion, but an approval is meant to actually restore access,
  // not just be a note on file.
  if (approve) {
    if (appeal.role === "driver") {
      await admin.from("driver_profiles").update({ suspended_until: null, suspension_reason: null }).eq("user_id", appeal.profile_id);
    } else {
      await admin.from("profiles").update({ suspended_until: null }).eq("id", appeal.profile_id);
    }
  }

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: approve ? "approve_suspension_appeal" : "reject_suspension_appeal",
    target_type: "suspension_appeals",
    target_id: id,
    details: { role: appeal.role, profile_id: appeal.profile_id, admin_notes: adminNotes },
  });

  return NextResponse.json({ ok: true });
}
