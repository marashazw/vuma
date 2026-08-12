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

  const admin = createAdminClient();
  const { data: offer } = await admin.from("subscription_holiday_offers").select("is_active").eq("id", id).single();
  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });

  await admin.from("subscription_holiday_offers").update({ is_active: !offer.is_active }).eq("id", id);

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: offer.is_active ? "deactivate_subscription_holiday_offer" : "activate_subscription_holiday_offer",
    target_type: "subscription_holiday_offers",
    target_id: id,
  });

  return NextResponse.json({ ok: true, isActive: !offer.is_active });
}
