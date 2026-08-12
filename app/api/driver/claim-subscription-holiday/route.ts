import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { offerId } = await req.json();
  if (!offerId) return NextResponse.json({ error: "An offer ID is required" }, { status: 400 });

  const admin = createAdminClient();

  // Deliberately re-verify eligibility here rather than trusting the
  // claim button only being shown to eligible drivers client-side — the
  // same "don't trust the UI as the enforcement boundary" principle
  // applied everywhere else money or access is granted in this app.
  const { data: membership } = await admin
    .from("vuma_associates_memberships")
    .select("status")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (membership?.status !== "active") {
    return NextResponse.json({ error: "An active Vuma Associates membership is required to claim this" }, { status: 403 });
  }

  const { data: offer } = await admin.from("subscription_holiday_offers").select("*, plan:subscription_plans(*)").eq("id", offerId).single();
  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  if (!offer.is_active) return NextResponse.json({ error: "This offer is no longer active" }, { status: 409 });

  const now = new Date();
  if (now < new Date(offer.claim_window_starts_at) || now > new Date(offer.claim_window_ends_at)) {
    return NextResponse.json({ error: "This offer isn't currently claimable" }, { status: 409 });
  }

  const { data: profile } = await admin.from("profiles").select("country").eq("id", user.id).single();
  if (profile?.country !== offer.plan?.country) {
    return NextResponse.json({ error: "This offer isn't available in your country" }, { status: 400 });
  }

  const { data: existingClaim } = await admin
    .from("subscription_holiday_claims")
    .select("id")
    .eq("offer_id", offerId)
    .eq("driver_id", user.id)
    .maybeSingle();
  if (existingClaim) return NextResponse.json({ error: "You've already claimed this offer" }, { status: 409 });

  const endsAt = new Date(now.getTime() + offer.duration_days * 24 * 60 * 60 * 1000).toISOString();

  const { data: newSub, error: subErr } = await admin
    .from("driver_subscriptions")
    .insert({
      driver_id: user.id,
      plan_id: offer.plan_id,
      status: "waived",
      starts_at: now.toISOString(),
      ends_at: endsAt,
      amount_paid: 0,
      waived_reason: "Vuma Associates subscription holiday",
    })
    .select()
    .single();

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

  const { error: claimErr } = await admin.from("subscription_holiday_claims").insert({
    offer_id: offerId,
    driver_id: user.id,
    driver_subscription_id: newSub.id,
  });
  // The unique (offer_id, driver_id) constraint is the real defence
  // against a double-claim race — if this specific insert fails on that
  // constraint, the subscription grant above already happened, so this
  // surfaces as a conflict rather than silently succeeding twice.
  if (claimErr) return NextResponse.json({ error: "You've already claimed this offer" }, { status: 409 });

  return NextResponse.json({ ok: true, subscription: newSub });
}
