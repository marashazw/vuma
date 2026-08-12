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
  const { data: restriction } = await admin.from("ride_access_restrictions").select("is_active").eq("id", id).single();
  if (!restriction) return NextResponse.json({ error: "Restriction not found" }, { status: 404 });

  await admin.from("ride_access_restrictions").update({ is_active: !restriction.is_active }).eq("id", id);

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: restriction.is_active ? "deactivate_ride_access_restriction" : "activate_ride_access_restriction",
    target_type: "ride_access_restrictions",
    target_id: id,
  });

  return NextResponse.json({ ok: true, isActive: !restriction.is_active });
}
