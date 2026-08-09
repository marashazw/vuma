import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveFullCommission, resolveTaxLevies } from "@/lib/commission";
import type { CountryCode } from "@/lib/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rideId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: ride } = await admin.from("rides").select("*").eq("id", rideId).single();
  if (!ride) return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  if (ride.driver_id !== user.id) {
    return NextResponse.json({ error: "Only this ride's driver can start it" }, { status: 403 });
  }
  if (ride.status !== "accepted") {
    return NextResponse.json({ error: "This ride isn't in a startable state" }, { status: 409 });
  }

  // A driver can only be actively driving one trip at a time. This is the
  // real enforcement — the driver-side UI also guides them away from a
  // newly-accepted ride while another is in progress, but that's just
  // guidance; this check is what actually prevents it regardless of how
  // the request gets made.
  const { data: otherActiveRide } = await admin
    .from("rides")
    .select("id")
    .eq("driver_id", ride.driver_id)
    .eq("status", "in_progress")
    .neq("id", rideId)
    .limit(1)
    .maybeSingle();
  if (otherActiveRide) {
    return NextResponse.json(
      { error: "You have another trip already in progress — complete it before starting a new one." },
      { status: 409 }
    );
  }

  const fare = Number(ride.final_fare ?? ride.rider_offer);
  const resolved = await resolveFullCommission(
    admin,
    {
      id: ride.id,
      driver_id: ride.driver_id,
      rider_id: ride.rider_id,
      country: ride.country as CountryCode,
      is_deluxe: ride.is_deluxe,
      is_scheduled: ride.is_scheduled,
      applied_credit_id: ride.applied_credit_id,
    },
    fare
  );

  // Deliberately independent of commission — applies "whether the driver
  // is on per-ride commission or a periodic subscription" (an explicit
  // requirement), so unlike commission there's no subscription exemption
  // here at all.
  const taxLevies = await resolveTaxLevies(admin, ride.country as CountryCode, fare);

  // Deduct from the driver's prepaid wallet — the actual fix for
  // commission previously only ever being *recorded* at completion, with
  // no real mechanism to collect it. Allowed to go negative here
  // deliberately: the real gate against driving without funds is checked
  // earlier, at go-online and bid-submission time — a trip that's already
  // been accepted should never be blocked from starting because of a
  // balance that dipped between acceptance and departure.
  const { data: driverProfile } = await admin
    .from("driver_profiles")
    .select("prepaid_wallet_balance, reserved_balance")
    .eq("user_id", ride.driver_id)
    .single();
  const balanceBefore = Number(driverProfile?.prepaid_wallet_balance || 0);
  const totalDeduction = Math.round((resolved.amount + taxLevies.total) * 100) / 100;
  const balanceAfter = Math.round((balanceBefore - totalDeduction) * 100) / 100;

  // If this was a scheduled ride, its expected commission was reserved at
  // acceptance to protect against the balance being spent elsewhere in
  // the meantime. That reservation's job ends here regardless of what the
  // freshly-resolved commission turns out to be — even if it comes back
  // as $0 (say, a referral credit got applied since acceptance), the
  // reservation still needs releasing, so this is computed and written
  // unconditionally rather than nested inside the deduction branch below.
  const newReserved = ride.commission_reserved
    ? Math.max(Number(driverProfile?.reserved_balance || 0) - Number(ride.commission_reserved), 0)
    : Number(driverProfile?.reserved_balance || 0);

  if (totalDeduction > 0) {
    await admin
      .from("driver_profiles")
      .update({ prepaid_wallet_balance: balanceAfter, reserved_balance: newReserved })
      .eq("user_id", ride.driver_id);
  } else if (ride.commission_reserved) {
    // No deduction at all after all, but a reservation still needs releasing.
    await admin.from("driver_profiles").update({ reserved_balance: newReserved }).eq("user_id", ride.driver_id);
  }

  if (resolved.amount > 0) {
    await admin.from("driver_wallet_transactions").insert({
      driver_id: ride.driver_id,
      ride_id: ride.id,
      type: "commission_deduction",
      amount: -resolved.amount,
      balance_after: balanceAfter,
      notes: `Commission (${resolved.pct.toFixed(1)}%, ${resolved.source}) on ${ride.currency} ${fare.toFixed(2)} fare`,
    });
  }

  // Each active charge gets its own wallet transaction row — a driver
  // looking at their own history should see exactly which charge (VAT,
  // a road levy, etc.) took what amount, not one opaque combined figure.
  for (const charge of taxLevies.breakdown) {
    if (charge.amount <= 0) continue;
    await admin.from("driver_wallet_transactions").insert({
      driver_id: ride.driver_id,
      ride_id: ride.id,
      type: "tax_levy_deduction",
      amount: -charge.amount,
      balance_after: balanceAfter,
      notes: `${charge.name} on ${ride.currency} ${fare.toFixed(2)} fare`,
    });
  }

  // This is what Admin → Transactions actually reads from — previously
  // only ever written at ride completion, which meant admin had no
  // visibility into a commission charge until long after it actually
  // happened (the driver's own wallet already reflected it correctly at
  // this point). Written once, here, at the moment the charge is real;
  // the completion route no longer writes a second one for the same ride.
  await admin.from("transactions").insert({
    ride_id: rideId,
    driver_id: ride.driver_id,
    rider_id: ride.rider_id,
    type: "ride_commission",
    amount: fare,
    commission_pct: resolved.pct,
    commission_amount: resolved.amount,
    commission_source: resolved.source,
    currency: ride.currency,
    gateway: "ride",
    status: "success",
  });

  // Tax/levy transactions are deliberately a separate type from
  // ride_commission — this is not Vuma revenue, it's money collected on
  // behalf of a regulator, and the Income Statement needs to be able to
  // tell the two apart rather than misstating either figure.
  for (const charge of taxLevies.breakdown) {
    if (charge.amount <= 0) continue;
    await admin.from("transactions").insert({
      ride_id: rideId,
      driver_id: ride.driver_id,
      rider_id: ride.rider_id,
      type: "tax_levy",
      amount: charge.amount,
      currency: ride.currency,
      gateway: "ride",
      charge_name: charge.name,
      status: "success",
    });
  }

  const { error } = await admin
    .from("rides")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
      wallet_commission_charged: resolved.amount,
      wallet_commission_pct: resolved.pct,
      tax_levy_charged: taxLevies.total,
      tax_levy_breakdown: taxLevies.breakdown.map((b) => ({ name: b.name, amount: b.amount })),
    })
    .eq("id", rideId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    commissionCharged: resolved.amount,
    commissionPct: resolved.pct,
    taxLevyCharged: taxLevies.total,
    taxLevyBreakdown: taxLevies.breakdown,
    newWalletBalance: totalDeduction > 0 ? balanceAfter : balanceBefore,
  });
}
