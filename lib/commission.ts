import type { CountryCode, DriverProfile, DriverSubscription, SubscriptionPlan } from "./types";

/**
 * Resolves the commission percentage that applies to a driver's next ride,
 * in priority order:
 *   1. An active subscription's built-in rate (0% for "unlimited" plans,
 *      or a reduced % for "reduced-commission" plans)
 *   2. A per-driver admin override (set or waived manually)
 *   3. The country-wide default rate
 *
 * This mirrors the admin's choice of "per-driver, both models available":
 * admins can put any individual driver on subscription pricing or leave
 * them on standard per-ride commission, at any time.
 */
export function resolveCommissionPct(params: {
  driver: Pick<DriverProfile, "commission_mode" | "commission_override_pct">;
  activeSubscription?: (DriverSubscription & { plan?: SubscriptionPlan }) | null;
  countryDefaultPct: number;
}): { pct: number; source: "subscription" | "override" | "country_default" } {
  const { driver, activeSubscription, countryDefaultPct } = params;

  if (
    driver.commission_mode === "subscription" &&
    activeSubscription &&
    (activeSubscription.status === "active" || activeSubscription.status === "waived") &&
    activeSubscription.plan
  ) {
    return { pct: activeSubscription.plan.commission_pct_while_active, source: "subscription" };
  }

  if (driver.commission_override_pct !== null && driver.commission_override_pct !== undefined) {
    return { pct: driver.commission_override_pct, source: "override" };
  }

  return { pct: countryDefaultPct, source: "country_default" };
}

export function commissionAmount(fare: number, pct: number): number {
  return Math.round(fare * (pct / 100) * 100) / 100;
}

/**
 * Full commission resolution — referral/reward credit, subscription,
 * override, country default, and the Vuma Deluxe multiplier — as a single
 * reusable step. Mirrors the logic in the ride completion route exactly
 * (kept as a separate function rather than a refactor of that route, to
 * avoid any risk of regressing its already-proven-correct behavior).
 * Used by the trip-start wallet deduction so the amount charged there and
 * the amount recorded at completion can never disagree.
 */
export async function resolveFullCommission(
  admin: any,
  ride: {
    id: string;
    driver_id: string;
    rider_id: string;
    country: CountryCode;
    is_deluxe: boolean;
    is_scheduled: boolean;
    applied_credit_id: string | null;
  },
  fare: number
): Promise<{ pct: number; source: string; amount: number; deluxeMultiplier: number | null; scheduledMultiplier: number | null }> {
  const { data: driverProfile } = await admin.from("driver_profiles").select("*").eq("user_id", ride.driver_id).single();

  let pct: number;
  let source: string;

  let creditValid = false;
  if (ride.applied_credit_id) {
    const { data: creditRow } = await admin
      .from("ride_credits")
      .select("rider_id, status")
      .eq("id", ride.applied_credit_id)
      .single();
    creditValid = !!creditRow && creditRow.rider_id === ride.rider_id && creditRow.status === "reserved";
  }

  if (creditValid) {
    pct = 0;
    source = "referral_credit";
  } else if ((driverProfile?.free_ride_credits || 0) > 0) {
    pct = 0;
    source = "reward_credit";
  } else {
    const { data: activeSub } = await admin
      .from("driver_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("driver_id", ride.driver_id)
      .in("status", ["active", "waived"])
      .gte("ends_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: commissionSetting } = await admin
      .from("commission_settings")
      .select("default_pct")
      .eq("country", ride.country)
      .single();

    const resolved = resolveCommissionPct({
      driver: driverProfile!,
      activeSubscription: activeSub as any,
      countryDefaultPct: commissionSetting?.default_pct ?? 10,
    });
    pct = resolved.pct;
    source = resolved.source;
  }

  let deluxeMultiplier: number | null = null;
  let scheduledMultiplier: number | null = null;
  if (ride.is_deluxe || ride.is_scheduled) {
    const { data: fareSettings } = await admin
      .from("fare_settings")
      .select("deluxe_multiplier, scheduled_multiplier")
      .eq("country", ride.country)
      .single();
    if (ride.is_deluxe) {
      deluxeMultiplier = Number(fareSettings?.deluxe_multiplier) || 1.5;
      pct = pct * deluxeMultiplier;
    }
    if (ride.is_scheduled) {
      scheduledMultiplier = Number(fareSettings?.scheduled_multiplier) || 1.2;
      pct = pct * scheduledMultiplier;
    }
    pct = Math.min(pct, 100);
  }

  return { pct, source, amount: commissionAmount(fare, pct), deluxeMultiplier, scheduledMultiplier };
}

export function periodDays(period: "weekly" | "monthly" | "once_off"): number {
  if (period === "weekly") return 7;
  if (period === "monthly") return 30;
  return 36500; // "once_off" — effectively no expiry, admin cancels manually
}

export function currencyFormat(amount: number, currency: string) {
  const symbol = currency === "ZAR" ? "R" : currency === "USD" ? "$" : currency;
  return `${symbol}${amount.toFixed(2)}`;
}
