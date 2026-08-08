import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Represents an indefinite hold, not a fixed term — the existing
// suspended_until field always means "suspended until this timestamp",
// so an open-ended manual freeze is expressed as a date far enough out
// that it functions as indefinite in practice, lifted explicitly by an
// admin via the unfreeze route once the investigation concludes.
const INDEFINITE_YEARS_OUT = 100;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single();
  if (!profile?.is_super_admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { profileId, role, reason } = await req.json();
  if (!profileId || !role || !reason || !reason.trim()) {
    return NextResponse.json({ error: "profileId, role, and a reason are all required" }, { status: 400 });
  }
  if (role !== "rider" && role !== "driver") {
    return NextResponse.json({ error: "role must be 'rider' or 'driver'" }, { status: 400 });
  }

  const admin = createAdminClient();
  const suspendedUntil = new Date();
  suspendedUntil.setFullYear(suspendedUntil.getFullYear() + INDEFINITE_YEARS_OUT);

  const table = role === "driver" ? "driver_profiles" : "profiles";
  const idColumn = role === "driver" ? "user_id" : "id";

  const { error } = await admin
    .from(table)
    .update({ suspended_until: suspendedUntil.toISOString(), suspension_reason: reason.trim() })
    .eq(idColumn, profileId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "manual_freeze",
    target_type: table,
    target_id: profileId,
    details: { role, reason: reason.trim() },
  });

  return NextResponse.json({ ok: true });
}
