import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveFullCommission } from "@/lib/commission";
import type { CountryCode } from "@/lib/types";

// A small grace margin — a bid that would only draw the wallet a few
// cents/rand below zero shouldn't be blocked outright, since rounding on
// the eventual real fare could land either side of the estimate made here.
const GRACE_DRAWDOWN: Record<string, number> = { ZAR: 1.0, USD: 0.1 };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rideId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { bidAmount } = await req.json();
  if (typeof bidAmount !== "number" || bidAmount <= 0) {
    return NextResponse.json({ error: "A valid bid amount is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: ride } = await admin
    .from("rides")
    .select("id, driver_id, rider_id, country, currency, is_deluxe, is_scheduled, applied_credit_id")
    .eq("id", rideId)
    .single();
  if (!ride) return NextResponse.json({ error: "Ride not found" }, { status: 404 });

  // A driver on an active subscription is exempt — same exemption already
  // used for the go-online and bid-submission gates elsewhere, since their
  // commission obligation isn't drawn from the prepaid wallet the same way.
  const { data: activeSub } = await admin
    .from("driver_subscriptions")
    .select("id")
    .eq("driver_id", user.id)
    .in("status", ["active", "waived"])
    .gte("ends_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (activeSub) return NextResponse.json({ canBid: true, exempt: true });

  const resolved = await resolveFullCommission(
    admin,
    {
      id: ride.id,
      driver_id: user.id,
      rider_id: ride.rider_id,
      country: ride.country as CountryCode,
      is_deluxe: ride.is_deluxe,
      is_scheduled: ride.is_scheduled,
      applied_credit_id: ride.applied_credit_id,
    },
    bidAmount
  );

  const { data: driverProfile } = await admin
    .from("driver_profiles")
    .select("prepaid_wallet_balance")
    .eq("user_id", user.id)
    .single();
  const currentBalance = Number(driverProfile?.prepaid_wallet_balance || 0);
  const resultingBalance = Math.round((currentBalance - resolved.amount) * 100) / 100;
  const grace = GRACE_DRAWDOWN[ride.currency] ?? 0.1;
  const canBid = resultingBalance >= -grace;

  return NextResponse.json({
    canBid,
    exempt: false,
    expectedCommission: resolved.amount,
    currentBalance,
    resultingBalance,
    grace,
    currency: ride.currency,
  });
}
