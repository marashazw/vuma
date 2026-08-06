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

  const { country, method_label, account_name, account_number, instructions, link_url, link_label, gateway_enabled } =
    await req.json();
  const admin = createAdminClient();

  const { error } = await admin
    .from("payment_instructions")
    .update({
      method_label,
      account_name,
      account_number,
      instructions,
      link_url,
      link_label,
      gateway_enabled,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("country", country);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
