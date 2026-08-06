import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, is_super_admin").eq("id", user.id).single();
  if (!profile?.is_super_admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const {
    country,
    provider_name,
    rapid_response_number,
    control_room_number,
    account_reference,
    coverage_notes,
    is_active,
  } = await req.json();

  const admin = createAdminClient();
  const { error } = await admin
    .from("security_providers")
    .update({
      provider_name,
      rapid_response_number,
      control_room_number,
      account_reference,
      coverage_notes,
      is_active,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("country", country);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "update_security_provider",
    target_type: "security_providers",
    target_id: country,
    details: { provider_name, is_active },
  });

  return NextResponse.json({ ok: true });
}
