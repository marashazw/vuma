import type { SupabaseClient } from "@supabase/supabase-js";

export interface RestrictionCheck {
  restricted: boolean;
  reason?: string;
}

/**
 * Checks whether an active, currently-in-window ride-access restriction
 * blocks this user from requesting or bidding on a ride right now. A
 * restriction only blocks someone who ISN'T an active (paid-up) Vuma
 * Associates member — an active member is always exempt from their own
 * benefit's restriction, by definition.
 */
export async function checkRideAccessRestriction(
  supabase: SupabaseClient,
  userId: string,
  isDeluxe: boolean
): Promise<RestrictionCheck> {
  const now = new Date().toISOString();
  const { data: restrictions } = await supabase
    .from("ride_access_restrictions")
    .select("scope, ends_at")
    .eq("is_active", true)
    .lte("starts_at", now)
    .gte("ends_at", now);

  const applicable = (restrictions || []).find((r) => r.scope === "all_rides" || (r.scope === "deluxe_only" && isDeluxe));
  if (!applicable) return { restricted: false };

  const { data: membership } = await supabase
    .from("vuma_associates_memberships")
    .select("status")
    .eq("profile_id", userId)
    .maybeSingle();

  if (membership?.status === "active") return { restricted: false };

  return {
    restricted: true,
    reason:
      applicable.scope === "deluxe_only"
        ? "Vuma Deluxe is reserved for active Vuma Associates members right now."
        : "Rides are reserved for active Vuma Associates members right now.",
  };
}
