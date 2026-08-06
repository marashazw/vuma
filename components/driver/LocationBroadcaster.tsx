"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function LocationBroadcaster() {
  const supabase = createClient();
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    let userId: string | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled || !navigator.geolocation) return;
      userId = user.id;

      watchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          if (!userId) return;
          await supabase
            .from("driver_profiles")
            .update({ current_lat: pos.coords.latitude, current_lng: pos.coords.longitude })
            .eq("user_id", userId);
        },
        (err) => console.warn("[LocationBroadcaster] geolocation error:", err.message),
        { enableHighAccuracy: true, maximumAge: 10000 }
      );
    })();

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [supabase]);

  return null;
}
