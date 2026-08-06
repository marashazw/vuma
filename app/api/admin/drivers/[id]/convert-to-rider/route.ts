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

  const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single();
  if (!profile?.is_super_admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const admin = createAdminClient();

  // Only flip the role — deliberately leave driver_profiles and any
  // history (ride_offers, driver_referrals, etc.) in place rather than
  // deleting it. If this account genuinely never drove, it's inert and
  // harmless; if it did, deleting it would destroy real history. Every
  // routing/permission check in the app keys off profiles.role, not the
  // mere existence of a driver_profiles row, so this alone fully restores
  // the normal rider experience.
  const { error } = await admin.from("profiles").update({ role: "rider" }).eq("id", driverId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "convert_driver_to_rider",
    target_type: "profiles",
    target_id: driverId,
    details: { reason: "Mistaken driver signup, likely via referral-link pre-selection" },
  });

  return NextResponse.json({ ok: true });
}
