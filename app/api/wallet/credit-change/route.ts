import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { COUNTRIES } from "@/lib/constants";
import type { CountryCode } from "@/lib/types";

function startOfMonthUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { rideId, amount } = await req.json();
  const creditAmount = Number(amount);
  if (!rideId || !creditAmount || creditAmount <= 0) {
    return NextResponse.json({ error: "A ride and a positive amount are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: ride, error: rideFetchErr } = await admin.from("rides").select("*").eq("id", rideId).single();
  if (rideFetchErr || !ride) {
    console.error("[credit-change] ride fetch failed:", rideFetchErr);
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  if (ride.driver_id !== user.id) {
    return NextResponse.json({ error: "Only this ride's driver can credit change" }, { status: 403 });
  }
  if (!["accepted", "in_progress", "completed"].includes(ride.status)) {
    return NextResponse.json({ error: "This ride isn't in a state where change can be credited" }, { status: 409 });
  }

  // Caps are admin-configurable (Admin → Commissions) — fare_settings is
  // the live source, falling back to the original hardcoded defaults only
  // if that row is somehow missing (shouldn't happen after migration 032,
  // but matches the same defensive fallback pattern used for
  // deluxe_multiplier and scheduled_multiplier elsewhere).
  const countryDefaults = COUNTRIES[ride.country as CountryCode];
  const { data: fareSettings } = await admin
    .from("fare_settings")
    .select("change_credit_per_rider_monthly, change_credit_driver_monthly, rider_wallet_accrual_monthly")
    .eq("country", ride.country)
    .single();
  const limits = {
    changeCreditPerRiderMonthly: fareSettings?.change_credit_per_rider_monthly ?? countryDefaults.changeCreditPerRiderMonthly,
    changeCreditDriverMonthly: fareSettings?.change_credit_driver_monthly ?? countryDefaults.changeCreditDriverMonthly,
    riderWalletAccrualMonthly: fareSettings?.rider_wallet_accrual_monthly ?? countryDefaults.riderWalletAccrualMonthly,
    currencySymbol: countryDefaults.currencySymbol,
  };
  const monthStart = startOfMonthUTC();

  console.log("[credit-change] check", {
    driverId: user.id,
    riderId: ride.rider_id,
    rideCountry: ride.country,
    rideCurrency: ride.currency,
    creditAmount,
    perRiderCap: limits.changeCreditPerRiderMonthly,
    driverCap: limits.changeCreditDriverMonthly,
    riderAccrualCap: limits.riderWalletAccrualMonthly,
    monthStart,
  });

  // Rider-level monthly accrual cap — how much this rider can receive in
  // total, from *any* drivers combined, this month. Deliberately not
  // scoped to driver_id, unlike the two checks below: the whole point of
  // this check is to catch what the other two structurally can't — a
  // rider receiving credit from several different drivers, each
  // correctly staying within their own individual limits.
  const { data: riderTotalTxns, error: riderTotalErr } = await admin
    .from("driver_credit_transactions")
    .select("amount")
    .eq("rider_id", ride.rider_id)
    .eq("type", "issued_change_credit")
    .gte("created_at", monthStart);

  if (riderTotalErr) {
    console.error("[credit-change] FAILED to read this rider's total accrual across all drivers:", riderTotalErr);
  }
  const riderAccruedTotal = (riderTotalTxns || []).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  console.log("[credit-change] riderAccruedTotal (all drivers) so far:", riderAccruedTotal);

  if (riderAccruedTotal + creditAmount > limits.riderWalletAccrualMonthly) {
    const remaining = Math.max(limits.riderWalletAccrualMonthly - riderAccruedTotal, 0);
    return NextResponse.json(
      {
        error:
          remaining > 0
            ? `This rider has already received ${limits.currencySymbol}${riderAccruedTotal.toFixed(2)} in wallet credit this month (from any driver) — you can add up to ${limits.currencySymbol}${remaining.toFixed(2)} more before they hit their monthly limit.`
            : `This rider has reached their ${limits.currencySymbol}${limits.riderWalletAccrualMonthly}/month wallet credit limit across all drivers — they'll be able to receive more next month.`,
      },
      { status: 400 }
    );
  }

  // Per-rider monthly cap check
  const { data: riderTxns, error: riderTxnsErr } = await admin
    .from("driver_credit_transactions")
    .select("amount")
    .eq("driver_id", user.id)
    .eq("rider_id", ride.rider_id)
    .eq("type", "issued_change_credit")
    .gte("created_at", monthStart);

  if (riderTxnsErr) {
    console.error("[credit-change] FAILED to read prior transactions for this rider:", riderTxnsErr);
  }
  const issuedToThisRider = (riderTxns || []).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  console.log("[credit-change] issuedToThisRider so far:", issuedToThisRider, "rows found:", riderTxns?.length ?? "ERROR");

  if (issuedToThisRider + creditAmount > limits.changeCreditPerRiderMonthly) {
    const remaining = Math.max(limits.changeCreditPerRiderMonthly - issuedToThisRider, 0);
    return NextResponse.json(
      {
        error:
          remaining > 0
            ? `${limits.currencySymbol}${creditAmount.toFixed(2)} exceeds your remaining monthly limit for this rider — you can still credit up to ${limits.currencySymbol}${remaining.toFixed(2)} this month.`
            : `You've reached the ${limits.currencySymbol}${limits.changeCreditPerRiderMonthly}/month limit for crediting this rider — you'll be able to credit them again next month.`,
      },
      { status: 400 }
    );
  }

  // Overall per-driver monthly issuing cap check
  const { data: allTxns, error: allTxnsErr } = await admin
    .from("driver_credit_transactions")
    .select("amount")
    .eq("driver_id", user.id)
    .eq("type", "issued_change_credit")
    .gte("created_at", monthStart);

  if (allTxnsErr) {
    console.error("[credit-change] FAILED to read prior transactions for this driver:", allTxnsErr);
  }
  const issuedTotal = (allTxns || []).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  console.log("[credit-change] issuedTotal so far:", issuedTotal, "rows found:", allTxns?.length ?? "ERROR");

  if (issuedTotal + creditAmount > limits.changeCreditDriverMonthly) {
    const remaining = Math.max(limits.changeCreditDriverMonthly - issuedTotal, 0);
    return NextResponse.json(
      {
        error:
          remaining > 0
            ? `${limits.currencySymbol}${creditAmount.toFixed(2)} exceeds your remaining monthly limit for issuing change credits — you can still credit up to ${limits.currencySymbol}${remaining.toFixed(2)} total this month, across any riders.`
            : `You've reached your ${limits.currencySymbol}${limits.changeCreditDriverMonthly}/month limit for issuing change credits — you'll be able to issue more next month.`,
      },
      { status: 400 }
    );
  }

  // All checks passed — apply the debit/credit
  const { data: driverProfile } = await admin.from("driver_profiles").select("credit_balance").eq("user_id", user.id).single();
  const { data: riderProfile } = await admin.from("profiles").select("wallet_balance, wallet_currency").eq("id", ride.rider_id).single();

  const driverCreditBalance = Number(driverProfile?.credit_balance || 0);
  if (driverCreditBalance < creditAmount) {
    return NextResponse.json(
      {
        error: `You only have ${limits.currencySymbol}${driverCreditBalance.toFixed(2)} of credit balance available — you can't issue more than you have.`,
      },
      { status: 400 }
    );
  }

  if (riderProfile?.wallet_currency && riderProfile.wallet_currency !== ride.currency) {
    return NextResponse.json(
      { error: `This rider's wallet is in ${riderProfile.wallet_currency}, can't add ${ride.currency} credit` },
      { status: 409 }
    );
  }

  const { error: debitErr } = await admin
    .from("driver_profiles")
    .update({ credit_balance: driverCreditBalance - creditAmount })
    .eq("user_id", user.id);
  if (debitErr) console.error("[credit-change] FAILED to debit driver credit_balance:", debitErr);

  const { error: creditErr } = await admin
    .from("profiles")
    .update({
      wallet_balance: Number(riderProfile?.wallet_balance || 0) + creditAmount,
      wallet_currency: riderProfile?.wallet_currency || ride.currency,
    })
    .eq("id", ride.rider_id);
  if (creditErr) console.error("[credit-change] FAILED to credit rider wallet_balance:", creditErr);

  const { error: ledgerErr } = await admin.from("driver_credit_transactions").insert({
    driver_id: user.id,
    type: "issued_change_credit",
    amount: -creditAmount,
    currency: ride.currency,
    ride_id: ride.id,
    rider_id: ride.rider_id,
    notes: "Change credited instead of cash",
  });
  if (ledgerErr) {
    console.error("[credit-change] CRITICAL: FAILED to insert driver_credit_transactions row — monthly caps will not track this credit:", ledgerErr);
  }

  const { error: walletTxnErr } = await admin.from("wallet_transactions").insert({
    rider_id: ride.rider_id,
    ride_id: ride.id,
    type: "change_credit",
    amount: creditAmount,
    currency: ride.currency,
    created_by: user.id,
    notes: "Change credited instead of cash by driver",
  });
  if (walletTxnErr) console.error("[credit-change] FAILED to insert wallet_transactions row:", walletTxnErr);

  return NextResponse.json({
    ok: true,
    remainingForThisRider: limits.changeCreditPerRiderMonthly - (issuedToThisRider + creditAmount),
    remainingOverall: limits.changeCreditDriverMonthly - (issuedTotal + creditAmount),
    _debug: {
      issuedToThisRiderBefore: issuedToThisRider,
      issuedTotalBefore: issuedTotal,
      ledgerWriteFailed: !!ledgerErr,
    },
  });
}
