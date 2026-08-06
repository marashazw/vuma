import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. NEVER import this from client components — it
 * bypasses Row Level Security entirely. Only use it in Route Handlers for
 * actions that must cross user boundaries: writing transactions, admin
 * commission overrides, subscription waivers, payment webhooks.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
