"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import { LocationSearchInput } from "@/components/map/LocationSearchInput";
import { reverseGeocode } from "@/lib/geo";
import type { VumaPrivateGroup, VumaAssociateMembership } from "@/lib/types";
import { Logo } from "@/components/ui/Logo";
import { Loader2, ArrowLeft, Users, Plus, Check, Clock, Sparkles } from "lucide-react";
import { BulkActionBar } from "@/components/ui/BulkActionBar";

const RideMap = dynamic(() => import("@/components/map/RideMap"), { ssr: false });

interface Point {
  label: string;
  lat: number;
  lng: number;
}

// Leads with "where do you want to go" first, matching the familiar
// regular-booking flow (same map, same location search, same "now"
// convenience), then asks who should see it — rather than requiring a
// detour into a specific group's own page before you could even say
// your destination. A group is picked (or created on the spot) as a
// second step, and can now be more than one group at once.
export default function VumaPrivateRequestPage() {
  const router = useRouter();
  const supabase = createClient();
  const modal = useModal();

  const [step, setStep] = useState<"details" | "audience">("details");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [membership, setMembership] = useState<VumaAssociateMembership | null>(null);
  const [groups, setGroups] = useState<VumaPrivateGroup[]>([]);

  const [pickup, setPickup] = useState<Point | null>(null);
  const [destination, setDestination] = useState<Point | null>(null);
  const [when, setWhen] = useState("");
  const [seats, setSeats] = useState(1);
  const [note, setNote] = useState("");
  const [wantsDeluxe, setWantsDeluxe] = useState(false);
  const [visibility, setVisibility] = useState<"group" | "platform">("group");

  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setUserId(user.id);

    const { data: mem } = await supabase.from("vuma_associates_memberships").select("*").eq("profile_id", user.id).maybeSingle();
    setMembership(mem as VumaAssociateMembership | null);

    const { data: memberships } = await supabase.from("vuma_private_group_members").select("group_id").eq("profile_id", user.id);
    const groupIds = (memberships || []).map((m) => m.group_id);
    if (groupIds.length) {
      const { data: groupData } = await supabase.from("vuma_private_groups").select("*").in("id", groupIds).order("created_at", { ascending: false });
      const list = (groupData as VumaPrivateGroup[]) || [];
      setGroups(list);
      if (list.length) setSelectedGroupIds(new Set([list[0].id]));
      else setShowNewGroup(true);
    } else {
      setShowNewGroup(true);
    }

    // Default the pickup point to the rider's actual current location,
    // same as the regular booking flow — reverse-geocoded so there's a
    // readable label rather than raw coordinates.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        const label = (await reverseGeocode(latitude, longitude)) || "Current location";
        setPickup({ label, lat: latitude, lng: longitude });
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setNow() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setWhen(now.toISOString().slice(0, 16));
  }

  function toggleGroup(id: string) {
    const next = new Set(selectedGroupIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedGroupIds(next);
  }

  function goToAudience() {
    if (!pickup || !destination || !when) return;
    setStep("audience");
  }

  async function submit() {
    if (!userId || !pickup || !destination) return;
    setSubmitting(true);

    let primaryGroupId: string | null = null;
    let additionalGroupIds: string[] = [];

    if (showNewGroup) {
      if (!newGroupName.trim()) {
        setSubmitting(false);
        return;
      }
      const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
      const { data: group, error: groupErr } = await supabase
        .from("vuma_private_groups")
        .insert({ name: newGroupName.trim(), description: newGroupDesc.trim() || null, invite_code: inviteCode, created_by: userId })
        .select()
        .single();
      if (groupErr) {
        setSubmitting(false);
        await modal.alert(`Could not create group: ${groupErr.message}`);
        return;
      }
      await supabase.from("vuma_private_group_members").insert({ group_id: group.id, profile_id: userId });
      primaryGroupId = group.id;
      additionalGroupIds = [...selectedGroupIds];
    } else {
      const ids = [...selectedGroupIds];
      if (!ids.length) {
        setSubmitting(false);
        await modal.alert("Choose at least one group, or create one, before continuing.");
        return;
      }
      primaryGroupId = ids[0];
      additionalGroupIds = ids.slice(1);
    }

    const { data: request, error } = await supabase
      .from("vuma_private_trip_requests")
      .insert({
        group_id: primaryGroupId,
        requested_by: userId,
        pickup_address: pickup.label,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        destination_address: destination.label,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
        needed_at: new Date(when).toISOString(),
        seats_needed: seats,
        note: note.trim() || null,
        wants_deluxe: wantsDeluxe,
        status: "open",
        visibility,
      })
      .select()
      .single();

    if (error) {
      setSubmitting(false);
      await modal.alert(`Could not post request: ${error.message}`);
      return;
    }

    // Additional groups beyond the primary one — a share row each, so
    // members of those groups can see this same request too.
    for (const groupId of additionalGroupIds) {
      await supabase.from("vuma_private_trip_request_shares").insert({ trip_request_id: request.id, group_id: groupId });
    }

    setSubmitting(false);
    router.push(`/vuma-private/trip-requests/${request.id}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-navy-300" />
      </div>
    );
  }

  if (membership?.status !== "active") {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-5">
        <div className="card p-6 max-w-sm text-center">
          <Users className="w-8 h-8 text-gold-500 mx-auto mb-3" />
          <p className="text-sm text-navy-600 mb-3">
            {membership?.status === "pending"
              ? "Your Vuma Private membership is awaiting confirmation."
              : "Active Vuma Private membership is required for this."}
          </p>
          {!membership && (
            <Link href="/vuma-associates/constitution" className="btn-primary w-full">
              Learn about Vuma Private
            </Link>
          )}
          {membership?.status === "pending" && (
            <Link href="/rider" className="btn-primary w-full">
              Back to book a ride
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="px-5 py-4 border-b border-navy-100 flex items-center gap-3">
        <button onClick={() => (step === "audience" ? setStep("details") : router.push("/rider-start"))} className="text-navy-400">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Logo />
      </header>

      <div className="max-w-md mx-auto px-5 py-8">
        {step === "details" ? (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold text-navy-800">Where do you want to go?</h1>
              <p className="text-xs text-navy-400 mt-1">
                Ask your group if anyone is driving and has space. You'll only split the actual fuel/toll costs.
                No fares, no profit.
              </p>
            </div>

            {pickup && (
              <div className="h-40 rounded-xl overflow-hidden border border-navy-100">
                <RideMap
                  pickup={[pickup.lat, pickup.lng]}
                  dropoff={destination ? [destination.lat, destination.lng] : null}
                  showPickupMarker
                />
              </div>
            )}

            <div>
              <label className="label block mb-1">Pickup</label>
              <LocationSearchInput value={pickup?.label} placeholder="Pickup location" onSelect={(r) => setPickup(r)} />
            </div>
            <div>
              <label className="label block mb-1">Destination</label>
              <LocationSearchInput value={destination?.label} placeholder="Where to" onSelect={(r) => setDestination(r)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label block mb-1">When</label>
                <div className="flex gap-1.5">
                  <input type="datetime-local" className="input flex-1" value={when} onChange={(e) => setWhen(e.target.value)} />
                  <button type="button" className="btn-ghost !px-2.5" onClick={setNow} title="Set to now">
                    <Clock className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="label block mb-1">Seats needed</label>
                <input type="number" min={1} className="input" value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer bg-navy-50 rounded-lg px-3 py-2.5">
              <input type="checkbox" className="w-4 h-4 accent-gold-400" checked={wantsDeluxe} onChange={(e) => setWantsDeluxe(e.target.checked)} />
              <span className="text-sm text-navy-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-gold-500" /> Prefer a Vuma Deluxe-class vehicle, if available
              </span>
            </label>

            <div>
              <label className="label block mb-1">Note (optional)</label>
              <input className="input" placeholder="e.g. Going for church, can help with fuel" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button className="btn-primary w-full" disabled={!pickup || !destination || !when} onClick={goToAudience}>
              Next: who should see this?
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold text-navy-800">Who should see this?</h1>
              <p className="text-xs text-navy-400 mt-1">Pick one or more groups, or create one if you don't have one yet.</p>
            </div>

            {!showNewGroup && groups.length > 0 && (
              <div className="space-y-2">
                {groups.length > 1 && (
                  <BulkActionBar
                    selectedCount={selectedGroupIds.size}
                    totalCount={groups.length}
                    allSelected={selectedGroupIds.size === groups.length}
                    onToggleSelectAll={() =>
                      setSelectedGroupIds(selectedGroupIds.size === groups.length ? new Set() : new Set(groups.map((g) => g.id)))
                    }
                    actions={[]}
                  />
                )}
                {groups.map((g) => (
                  <label key={g.id} className={`card p-4 flex items-center gap-3 cursor-pointer ${selectedGroupIds.has(g.id) ? "border-jade-400" : ""}`}>
                    <input type="checkbox" className="w-4 h-4 accent-gold-400" checked={selectedGroupIds.has(g.id)} onChange={() => toggleGroup(g.id)} />
                    <span className="text-sm font-medium text-navy-700">{g.name}</span>
                  </label>
                ))}
                <button className="text-xs text-navy-400 underline" onClick={() => setShowNewGroup(true)}>
                  Or create a new group too
                </button>
              </div>
            )}

            {showNewGroup && (
              <div className="card p-4 space-y-3">
                <p className="text-xs text-navy-400 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> New group
                </p>
                <input className="input" placeholder="Group name (e.g. St. Mary's Church Group)" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                <input className="input" placeholder="Description (optional)" value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value)} />
                {groups.length > 0 && (
                  <button className="text-xs text-navy-400 underline" onClick={() => setShowNewGroup(false)}>
                    Use existing groups instead
                  </button>
                )}
              </div>
            )}

            <label className="flex items-start gap-2.5 cursor-pointer bg-navy-50 rounded-lg px-3 py-2.5">
              <input
                type="checkbox"
                className="w-4 h-4 mt-0.5 shrink-0 accent-gold-400"
                checked={visibility === "platform"}
                onChange={(e) => setVisibility(e.target.checked ? "platform" : "group")}
              />
              <span className="text-xs text-navy-600">
                <span className="font-semibold">Also show to all Vuma Private members</span>, not just the group(s)
                above — off by default.
              </span>
            </label>

            <button
              className="btn-primary w-full"
              disabled={submitting || (showNewGroup ? !newGroupName.trim() : !selectedGroupIds.size)}
              onClick={submit}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Ask My Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
