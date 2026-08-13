"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { Loader2, Search, ShieldAlert, Snowflake, Users } from "lucide-react";
import { format } from "date-fns";

export default function AdminRidersPage() {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [riders, setRiders] = useState<Profile[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  async function loadMembership(riderIds: string[]) {
    if (!riderIds.length) {
      setMemberIds(new Set());
      return;
    }
    const { data } = await supabase.from("vuma_associates_memberships").select("profile_id").eq("status", "active").in("profile_id", riderIds);
    setMemberIds(new Set((data || []).map((m) => m.profile_id)));
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

      {loading ? (
        <div className="flex items-center justify-center py-16 text-navy-300">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
        </div>
      ) : (
        <div className="space-y-2">
          {!riders.length && <p className="text-navy-400 text-sm">No riders match that search.</p>}
          {riders.map((r) => {
            const isFrozen = !!r.suspended_until && new Date(r.suspended_until) > new Date();
            return (
              <Link key={r.id} href={`/admin/riders/${r.id}`} className="card p-4 flex items-center justify-between block hover:border-gold-300">
                <div>
                  <p className="font-semibold text-sm flex items-center gap-1.5">
                    {r.full_name}
                    {isFrozen && <Snowflake className="w-3.5 h-3.5 text-coral-500" />}
                    {r.scheduled_ride_strikes > 0 && <ShieldAlert className="w-3.5 h-3.5 text-gold-500" />}
                    {memberIds.has(r.id) && (
                      <span title="Vuma Private member">
                        <Users className="w-3.5 h-3.5 text-jade-500" />
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
