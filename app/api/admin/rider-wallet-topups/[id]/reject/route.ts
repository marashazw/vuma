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

  const { rejectionReason } = await req.json().catch(() => ({ rejectionReason: null }));
  const admin = createAdminClient();

  const { data: topup } = await admin.from("rider_wallet_topups").select("status").eq("id", id).single();
  if (!topup) return NextResponse.json({ error: "Top-up request not found" }, { status: 404 });
  if (topup.status !== "pending") {
    return NextResponse.json({ error: "This request has already been reviewed" }, { status: 409 });
  }

  await admin
    .from("rider_wallet_topups")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason || null,
    })
    .eq("id", id);

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "reject_rider_wallet_topup",
    target_type: "rider_wallet_topups",
    target_id: id,
    details: { rejectionReason },
  });

  return NextResponse.json({ ok: true });
}
