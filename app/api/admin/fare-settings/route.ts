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
    base_fare,
    per_km,
    low_multiplier,
    high_multiplier,
    round_to,
    deluxe_multiplier,
    scheduled_multiplier,
    change_credit_per_rider_monthly,
    change_credit_driver_monthly,
  } = await req.json();
  const admin = createAdminClient();

  console.log("[fare-settings] PATCH request:", {
    country,
    base_fare,
    per_km,
    low_multiplier,
    high_multiplier,
    round_to,
    deluxe_multiplier,
    scheduled_multiplier,
    change_credit_per_rider_monthly,
    change_credit_driver_monthly,
  });

  const { data: updatedRows, error } = await admin
    .from("fare_settings")
    .update({
      base_fare,
      per_km,
      low_multiplier,
      high_multiplier,
      round_to,
      deluxe_multiplier,
      scheduled_multiplier,
      change_credit_per_rider_monthly,
      change_credit_driver_monthly,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("country", country)
    .select();

  if (error) {
    console.error("[fare-settings] update failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!updatedRows || updatedRows.length === 0) {
    console.error(
      `[fare-settings] update matched 0 rows for country="${country}" — the row likely doesn't exist. Did migration 013_fare_settings.sql run?`
    );
    return NextResponse.json(
      { error: `No fare_settings row exists for country "${country}" — check that migration 013 ran.` },
      { status: 404 }
    );
  }

  console.log("[fare-settings] updated successfully:", updatedRows[0]);

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "update_fare_settings",
    target_type: "fare_settings",
    target_id: country,
    details: { base_fare, per_km, low_multiplier, high_multiplier },
  });

  return NextResponse.json({ ok: true });
}
