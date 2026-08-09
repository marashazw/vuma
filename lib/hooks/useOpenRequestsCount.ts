"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Count of currently open ride requests (requested/negotiating) in the
 * driver's own country — a lightweight approximation for a nav badge,
 * not a full replica of the dashboard's seat-capacity/Deluxe-certification
 * filtering, which matters for deciding what to show in the actual list
 * but is more detail than a simple count badge needs.
 *
 * IMPORTANT: call this exactly once per page (see DriverNavCountProvider)
 * and pass the result down as a prop to anything that needs it — calling
 * it from multiple simultaneously-mounted components (as an earlier
 * version of this did, once from the mobile bottom nav and once from the
 * desktop tabs, both always mounted regardless of viewport, just
 * CSS-hidden) created two realtime subscriptions racing for the same
 * channel name, which is exactly the kind of thing that causes a
 * reconnect loop and a genuine browser crash from resource exhaustion.
 * The channel name here is still made unique per mount as a second,
 * independent safeguard, in case this hook is ever called from more than
 * one place again in the future.
 */
export function useOpenRequestsCount(): number {
  const supabase = createClient();
  const [count, setCount] = useState(0);
  const channelNameRef = useRef(`open-requests-count-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("country").eq("id", user.id).single();
      const { count: c } = await supabase
        .from("rides")
        .select("*", { count: "exact", head: true })
        .in("status", ["requested", "negotiating"])
        .eq("country", profile?.country || "ZA");
      if (!cancelled) setCount(c || 0);
    }

    load();

    const channel = supabase
      .channel(channelNameRef.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return count;
}
