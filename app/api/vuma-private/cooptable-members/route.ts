import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { groupId } = await req.json();
  if (!groupId) return NextResponse.json({ error: "A group ID is required" }, { status: 400 });

  const admin = createAdminClient();

  // Confirm the requester is actually a member of this group before
  // revealing anything — same "don't trust the caller's claim" principle
  // used everywhere else membership or access is checked server-side.
  const { data: isMember } = await admin
    .from("vuma_private_group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!isMember) return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });

  const { data: existingMembers } = await admin.from("vuma_private_group_members").select("profile_id").eq("group_id", groupId);
  const excludeIds = (existingMembers || []).map((m) => m.profile_id);

  const { data: cooptable } = await admin
    .from("vuma_associates_memberships")
    .select("profile_id")
    .eq("status", "active")
    .eq("auto_accept_cooption", true);
  const cooptableIds = (cooptable || []).map((m) => m.profile_id).filter((id) => !excludeIds.includes(id));

  if (!cooptableIds.length) return NextResponse.json({ members: [] });

  const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", cooptableIds);

  return NextResponse.json({ members: profiles || [] });
}
