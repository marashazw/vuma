"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { haversineKm } from "@/lib/geo";
import { Car, Loader2, User } from "lucide-react";

const RADIUS_KM = 15;
const MAX_AVATARS = 5;

interface NearbyDriver {
  userId: string;
  avatarUrl: string | null;
  name: string;
}

export function NearbyDriversBadge({ pickup }: { pickup: { lat: number; lng: number } | null }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<{ count: number; etaMin: number; closest: NearbyDriver[] } | null>(null);

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
        .select("user_id, current_lat, current_lng")
        .eq("is_online", true)
        .eq("verification_status", "verified")
        .not("current_lat", "is", null)
        .not("current_lng", "is", null);

      if (cancelled) return;

      const nearby = (data || [])
        .map((d) => ({ userId: d.user_id, distKm: haversineKm(pickup.lat, pickup.lng, d.current_lat!, d.current_lng!) }))
        .filter((d) => d.distKm <= RADIUS_KM)
        .sort((a, b) => a.distKm - b.distKm);

      if (!nearby.length) {
        setInfo({ count: 0, etaMin: 0, closest: [] });
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

      // A direct client query to profiles won't work here — RLS only
      // grants visibility into your own row, admin, or someone you
      // already share an active ride with, and browsing nearby drivers
      // happens *before* any ride exists. This route deliberately
      // returns only name and avatar, and only for genuinely online,
      // verified drivers, via the service-role client.
      const avatarIds = closest.slice(0, MAX_AVATARS).map((d) => d.userId);
      const res = await fetch("/api/drivers/public-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverIds: avatarIds }),
      });
      const { drivers } = await res.json();
      const profileById: Record<string, { full_name: string; avatar_url: string | null }> = {};
      (drivers || []).forEach((p: any) => (profileById[p.id] = p));

      const closestWithAvatars: NearbyDriver[] = closest.slice(0, MAX_AVATARS).map((d) => ({
        userId: d.userId,
        avatarUrl: profileById[d.userId]?.avatar_url || null,
        name: profileById[d.userId]?.full_name || "Driver",
      }));

      if (cancelled) return;
      setInfo({ count: nearby.length, etaMin, closest: closestWithAvatars });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [pickup?.lat, pickup?.lng, supabase]);

  if (!pickup) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-navy-500 mt-2">
      {loading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking driver availability&hellip;
        </>
      ) : info && info.count > 0 ? (
        <>
          <div className="flex items-center -space-x-2 shrink-0">
            {info.closest.map((d) =>
              d.avatarUrl ? (
                <img
                  key={d.userId}
                  src={d.avatarUrl}
                  alt={d.name}
                  className="w-6 h-6 rounded-full object-cover border-2 border-paper"
                />
              ) : (
                <div
                  key={d.userId}
                  className="w-6 h-6 rounded-full bg-navy-100 border-2 border-paper flex items-center justify-center"
                  title={d.name}
                >
                  <User className="w-3 h-3 text-navy-400" />
                </div>
              )
            )}
          </div>
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
