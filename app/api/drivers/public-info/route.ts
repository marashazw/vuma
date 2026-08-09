import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour — comfortably covers a rider's session on the request page, never cached long-term

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { driverIds } = await req.json();
  if (!Array.isArray(driverIds) || !driverIds.length) {
    return NextResponse.json({ drivers: [] });
  }

  const admin = createAdminClient();

  // Deliberately re-verify online + verified here rather than trusting
  // the caller's list — this keeps the endpoint from being usable as a
  // general "look up any user's name/photo" tool by only ever returning
  // data for drivers who are currently, genuinely part of the public
  // fleet (the same "public fleet visibility is required for matching"
  // reasoning driver_profiles' own select policy already relies on).
  //
  // The actual profile photo lives at profile_photo_path (uploaded during
  // verification, explicitly labelled "shown to riders" in that flow) —
  // not profiles.avatar_url, which nothing in this codebase ever writes
  // to. It's also stored in the private driver-documents bucket alongside
  // ID documents, so a plain public URL won't work — this generates a
  // short-lived signed URL instead, via the service-role client, the only
  // way a rider's browser can legitimately load it.
  const { data: onlineDrivers } = await admin
    .from("driver_profiles")
    .select("user_id, profile_photo_path")
    .in("user_id", driverIds)
    .eq("is_online", true)
    .eq("verification_status", "verified");

  const validDrivers = onlineDrivers || [];
  const validIds = validDrivers.map((d) => d.user_id);

  const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", validIds.length ? validIds : ["-"]);
  const nameById: Record<string, string> = {};
  (profiles || []).forEach((p) => (nameById[p.id] = p.full_name));

  const photoPaths = validDrivers.filter((d) => d.profile_photo_path).map((d) => d.profile_photo_path as string);
  let signedUrlByPath: Record<string, string> = {};
  if (photoPaths.length) {
    const { data: signedUrls } = await admin.storage.from("driver-documents").createSignedUrls(photoPaths, SIGNED_URL_EXPIRY_SECONDS);
    (signedUrls || []).forEach((s) => {
      if (s.signedUrl && !s.error) signedUrlByPath[s.path!] = s.signedUrl;
    });
  }

  const drivers = validDrivers.map((d) => ({
    id: d.user_id,
    full_name: nameById[d.user_id] || "Driver",
    avatar_url: d.profile_photo_path ? signedUrlByPath[d.profile_photo_path] || null : null,
  }));

  return NextResponse.json({ drivers });
}
