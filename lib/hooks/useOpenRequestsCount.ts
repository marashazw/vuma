"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Count of currently open ride requests (requested/negotiating) in the
 * driver's own country — a lightweight approximation for a nav badge,
 * not a full replica of the dashboard's seat-capacity/Deluxe-certification
 * filtering, which matters for deciding what to show in the actual list
 * but is more detail than a simple count badge needs.
 */
export function useOpenRequestsCount(): number {
  const supabase = createClient();
  const [count, setCount] = useState(0);

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
      .channel("open-requests-count")
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
