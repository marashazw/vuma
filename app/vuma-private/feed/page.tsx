"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { VumaPrivateTripRequest, VumaAssociateMembership, Profile } from "@/lib/types";
import { Loader2, ArrowLeft, MapPin, Users2, Calendar, Globe2 } from "lucide-react";
import { format } from "date-fns";

export default function VumaPrivateFeedPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<VumaAssociateMembership | null>(null);
  const [requests, setRequests] = useState<(VumaPrivateTripRequest & { requester?: Profile })[]>([]);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: mem } = await supabase
      .from("vuma_associates_memberships")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle();
    setMembership(mem as VumaAssociateMembership | null);

    if (mem?.status === "active") {
      const { data: reqs } = await supabase
        .from("vuma_private_trip_requests")
        .select("*")
        .eq("visibility", "platform")
        .eq("status", "open")
        .order("needed_at", { ascending: true });
      const requesterIds = [...new Set((reqs || []).map((r) => r.requested_by))];
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", requesterIds.length ? requesterIds : ["-"]);
      setRequests((reqs || []).map((r: any) => ({ ...r, requester: (profiles as Profile[] || []).find((p) => p.id === r.requested_by) })));
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="px-5 py-4 border-b border-navy-100 flex items-center gap-3">
        <Link href="/vuma-private" className="text-navy-400">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <p className="font-bold text-navy-800 flex items-center gap-1.5">
          <Globe2 className="w-4 h-4" /> Vuma Private-wide requests
        </p>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">
        <p className="text-xs text-navy-400">
          Only trip requests the poster chose to widen beyond their own group appear here — most requests stay
          visible to their group alone. Any active Vuma Private member can respond to one of these.
        </p>

        {membership?.status !== "active" ? (
          <div className="card p-5 bg-navy-50 text-sm text-navy-500">
            Active Vuma Private membership is required to see this.
          </div>
        ) : !requests.length ? (
          <p className="text-navy-400 text-sm">No Vuma Private-wide requests open right now.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <Link key={r.id} href={`/vuma-private/trip-requests/${r.id}`} className="card p-4 block border bg-jade-50 border-jade-200">
                <p className="font-semibold text-sm flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {r.pickup_address ? (
                    <span>
                      From <span className="text-navy-500 font-normal">{r.pickup_address.split(",")[0]}</span> to {r.destination_address}
                    </span>
                  ) : (
                    r.destination_address
                  )}
                </p>
                <p className="text-xs flex items-center gap-3 opacity-80 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {format(new Date(r.needed_at), "EEE d MMM, HH:mm")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users2 className="w-3 h-3" /> {r.seats_needed} seat{r.seats_needed > 1 ? "s" : ""}
                  </span>
                </p>
                <p className="text-xs opacity-70 mt-1">{r.requester?.full_name || "Member"}{r.note ? ` — ${r.note}` : ""}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
