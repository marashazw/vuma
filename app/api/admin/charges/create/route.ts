import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single();
  if (!profile?.is_super_admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { name, country, charge_kind, rate, flat_amount } = await req.json();
  if (!name?.trim() || !country) {
    return NextResponse.json({ error: "A name and country are both required" }, { status: 400 });
  }
  if (charge_kind !== "percentage" && charge_kind !== "flat") {
    return NextResponse.json({ error: "charge_kind must be 'percentage' or 'flat'" }, { status: 400 });
  }
  if (charge_kind === "percentage" && (rate === null || rate === undefined || rate < 0)) {
    return NextResponse.json({ error: "A valid rate is required for a percentage charge" }, { status: 400 });
  }
  if (charge_kind === "flat" && (flat_amount === null || flat_amount === undefined || flat_amount < 0)) {
    return NextResponse.json({ error: "A valid amount is required for a flat charge" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("charge_types")
    .insert({
      name: name.trim(),
      country,
      charge_kind,
      rate: charge_kind === "percentage" ? rate : null,
      flat_amount: charge_kind === "flat" ? flat_amount : null,
      is_active: true,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "create_charge_type",
    target_type: "charge_types",
    target_id: data.id,
    details: { name, country, charge_kind, rate, flat_amount },
  });

  return NextResponse.json({ ok: true, charge: data });
}
