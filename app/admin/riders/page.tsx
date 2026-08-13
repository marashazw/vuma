"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { Loader2, Search, ShieldAlert, Snowflake, Users, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";

type SortKey = "recent" | "oldest" | "name" | "vuma_private" | "strikes" | "frozen";

// Membership status priority for sorting — active first, since that's
// what admin most often wants grouped together, down to no membership
// at all last.
const MEMBERSHIP_RANK: Record<string, number> = { active: 0, pending: 1, lapsed: 2, revoked: 3, none: 4 };

export default function AdminRidersPage() {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [riders, setRiders] = useState<Profile[]>([]);
  const [membershipStatus, setMembershipStatus] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("recent");

  async function loadMembership(riderIds: string[]) {
    if (!riderIds.length) {
      setMembershipStatus({});
      return;
    }
    const { data } = await supabase.from("vuma_associates_memberships").select("profile_id, status").in("profile_id", riderIds);
    const map: Record<string, string> = {};
    (data || []).forEach((m) => (map[m.profile_id] = m.status));
    setMembershipStatus(map);
  }

  async function loadRecent() {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "rider")
      .order("created_at", { ascending: false })
      .limit(30);
    setRiders((data as Profile[]) || []);
    await loadMembership((data || []).map((r) => r.id));
    setLoading(false);
  }

  useEffect(() => {
    loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search() {
    if (!query.trim()) {
      loadRecent();
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "rider")
      .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(30);
    setRiders((data as Profile[]) || []);
    await loadMembership((data || []).map((r) => r.id));
    setSearching(false);
  }

  const sortedRiders = useMemo(() => {
    const copy = [...riders];
    switch (sortBy) {
      case "oldest":
        return copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case "name":
        return copy.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
      case "vuma_private":
        return copy.sort((a, b) => {
          const rankA = MEMBERSHIP_RANK[membershipStatus[a.id] || "none"];
          const rankB = MEMBERSHIP_RANK[membershipStatus[b.id] || "none"];
          return rankA - rankB || (a.full_name || "").localeCompare(b.full_name || "");
        });
      case "strikes":
        return copy.sort((a, b) => (b.scheduled_ride_strikes || 0) - (a.scheduled_ride_strikes || 0));
      case "frozen":
        return copy.sort((a, b) => {
          const frozenA = !!a.suspended_until && new Date(a.suspended_until) > new Date() ? 0 : 1;
          const frozenB = !!b.suspended_until && new Date(b.suspended_until) > new Date() ? 0 : 1;
          return frozenA - frozenB;
        });
      case "recent":
      default:
        return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }, [riders, sortBy, membershipStatus]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Riders</h1>
        <p className="text-navy-400 text-sm mt-1">Basic lookup by name, phone, or email.</p>
      </div>

      <div className="flex items-center gap-2">
        <input
          className="input flex-1"
          placeholder="Search name, phone, or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button className="btn-primary !py-2.5 !px-4" onClick={search} disabled={searching}>
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-navy-500">
        <ArrowUpDown className="w-3.5 h-3.5 shrink-0" /> Sort by
        <select className="input !py-1.5 !text-xs flex-1" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
          <option value="recent">Most recently joined</option>
          <option value="oldest">Oldest joined</option>
          <option value="name">Name (A–Z)</option>
          <option value="vuma_private">Vuma Private membership</option>
          <option value="strikes">Scheduled-ride strikes (most first)</option>
          <option value="frozen">Frozen accounts first</option>
        </select>
      </label>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-navy-300">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
        </div>
      ) : (
        <div className="space-y-2">
          {!sortedRiders.length && <p className="text-navy-400 text-sm">No riders match that search.</p>}
          {sortedRiders.map((r) => {
            const isFrozen = !!r.suspended_until && new Date(r.suspended_until) > new Date();
            const status = membershipStatus[r.id];
            return (
              <Link key={r.id} href={`/admin/riders/${r.id}`} className="card p-4 flex items-center justify-between block hover:border-gold-300">
                <div>
                  <p className="font-semibold text-sm flex items-center gap-1.5">
                    {r.full_name}
                    {isFrozen && <Snowflake className="w-3.5 h-3.5 text-coral-500" />}
                    {r.scheduled_ride_strikes > 0 && <ShieldAlert className="w-3.5 h-3.5 text-gold-500" />}
                    {status === "active" && (
                      <span title="Vuma Private member">
                        <Users className="w-3.5 h-3.5 text-jade-500" />
                      </span>
                    )}
                    {status === "pending" && (
                      <span title="Vuma Private — pending">
                        <Users className="w-3.5 h-3.5 text-gold-400" />
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-navy-400">{r.phone || r.email || "—"}</p>
                </div>
                <p className="text-xs text-navy-400">Joined {format(new Date(r.created_at), "d MMM yyyy")}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
