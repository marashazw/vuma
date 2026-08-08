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

  const { label, title, body, link_url, link_label, position, expires_at } = await req.json();
  if (!label?.trim() || !title?.trim()) {
    return NextResponse.json({ error: "A label and a title are both required" }, { status: 400 });
  }
  if (position !== "left" && position !== "right") {
    return NextResponse.json({ error: "position must be 'left' or 'right'" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("driver_notices")
    .insert({
      label: label.trim(),
      title: title.trim(),
      body: body?.trim() || null,
      link_url: link_url?.trim() || null,
      link_label: link_label?.trim() || null,
      position,
      expires_at: expires_at || null,
      created_by: user.id,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "create_driver_notice",
    target_type: "driver_notices",
    target_id: data.id,
    details: { label, title, position },
  });

  return NextResponse.json({ ok: true, notice: data });
}
