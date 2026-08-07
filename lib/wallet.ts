import type { SupabaseClient } from "@supabase/supabase-js";

const USAGE_LOOKBACK_DAYS = 30;
const LOW_BALANCE_FRACTION = 0.3;

export interface LowBalanceCheck {
  isLow: boolean;
  threshold: number;
  lastTopupAmount: number;
  avgDailyUsage: number;
}

/**
 * A driver's low-balance threshold is personalized, not a flat number:
 * 30% of whichever is higher between their most recent top-up amount and
 * their average daily commission usage over the last 30 days. A driver who
 * tops up in large, infrequent chunks and one who tops up little-and-often
 * have very different "getting low" points, and a single flat threshold
 * wouldn't serve either of them well.
 */
export async function checkLowBalance(
  supabase: SupabaseClient,
  driverId: string,
  currentBalance: number
): Promise<LowBalanceCheck> {
  const { data: lastTopup } = await supabase
    .from("driver_wallet_transactions")
    .select("amount, created_at")
    .eq("driver_id", driverId)
    .eq("type", "topup")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastTopupAmount = Number(lastTopup?.amount) || 0;

  const lookbackStart = new Date(Date.now() - USAGE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const { data: deductions } = await supabase
    .from("driver_wallet_transactions")
    .select("amount, created_at")
    .eq("driver_id", driverId)
    .eq("type", "commission_deduction")
    .gte("created_at", lookbackStart.toISOString());

  let avgDailyUsage = 0;
  if (deductions && deductions.length) {
    const total = deductions.reduce((sum, d) => sum + Math.abs(Number(d.amount)), 0);
    // Average over however many days of data actually exist (capped at
    // the lookback window), not always divided by the full 30 — a driver
    // who only started a week ago shouldn't have their average diluted by
    // 23 days with no activity.
    const earliest = deductions.reduce(
      (min, d) => Math.min(min, new Date(d.created_at).getTime()),
      Date.now()
    );
    const daysOfData = Math.max(1, Math.min(USAGE_LOOKBACK_DAYS, (Date.now() - earliest) / (24 * 60 * 60 * 1000)));
    avgDailyUsage = total / daysOfData;
  }

  const threshold = Math.max(lastTopupAmount, avgDailyUsage) * LOW_BALANCE_FRACTION;

  return {
    isLow: threshold > 0 && currentBalance < threshold,
    threshold,
    lastTopupAmount,
    avgDailyUsage,
  };
}
