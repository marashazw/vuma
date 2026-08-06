"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { haversineKm } from "@/lib/geo";
import { Car, Loader2 } from "lucide-react";

const RADIUS_KM = 15;

export function NearbyDriversBadge({ pickup }: { pickup: { lat: number; lng: number } | null }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<{ count: number; etaMin: number } | null>(null);

  useEffect(() => {
    if (!pickup) {
      setInfo(null);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data } = await supabase
        .from("driver_profiles")
        .select("current_lat, current_lng")
        .eq("is_online", true)
        .eq("verification_status", "verified")
        .not("current_lat", "is", null)
        .not("current_lng", "is", null);

      if (cancelled) return;

      const nearby = (data || [])
        .map((d) => ({ distKm: haversineKm(pickup.lat, pickup.lng, d.current_lat!, d.current_lng!) }))
        .filter((d) => d.distKm <= RADIUS_KM)
        .sort((a, b) => a.distKm - b.distKm);

      if (!nearby.length) {
        setInfo({ count: 0, etaMin: 0 });
        setLoading(false);
        return;
      }

      // Average the closest few for a representative ETA feel, same
      // straight-line-padded-25%-at-30km/h estimate used elsewhere (see
      // getRoadRoute's fallback in lib/geo.ts) for consistency.
      const closest = nearby.slice(0, 5);
      const avgDistKm = closest.reduce((s, d) => s + d.distKm, 0) / closest.length;
      const roadKm = avgDistKm * 1.25;
      const etaMin = Math.max(Math.round((roadKm / 30) * 60), 1);

      setInfo({ count: nearby.length, etaMin });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [pickup?.lat, pickup?.lng, supabase]);

  if (!pickup) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-navy-500 mt-2">
      {loading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking driver availability&hellip;
        </>
      ) : info && info.count > 0 ? (
        <>
          <Car className="w-3.5 h-3.5 text-jade-500" />
          <span>
            <strong className="text-navy-700">{info.count}</strong> driver{info.count > 1 ? "s" : ""} nearby, ~
            {info.etaMin} min away
          </span>
        </>
      ) : (
        <>
          <Car className="w-3.5 h-3.5 text-navy-300" /> No drivers online nearby right now — your request will still
          go out
        </>
      )}
    </div>
  );
}
