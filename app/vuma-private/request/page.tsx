"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import type { VumaPrivateGroup, VumaAssociateMembership } from "@/lib/types";
import { Logo } from "@/components/ui/Logo";
import { Loader2, ArrowLeft, Users, Plus, Check } from "lucide-react";

// Leads with "where do you want to go" first, matching the familiar
// regular-booking flow, then asks who should see it — rather than the
// original flow, which required navigating into a specific group before
// you could even say where you were going. A group is picked (or
// created on the spot, if none exist yet) as the second step, not the
// first.
export default function VumaPrivateRequestPage() {
  const router = useRouter();
  const supabase = createClient();
  const modal = useModal();

  const [step, setStep] = useState<"details" | "audience">("details");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [membership, setMembership] = useState<VumaAssociateMembership | null>(null);
  const [groups, setGroups] = useState<VumaPrivateGroup[]>([]);

  const [destination, setDestination] = useState("");
  const [when, setWhen] = useState("");
  const [seats, setSeats] = useState(1);
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<"group" | "platform">("group");

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
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
      if (list.length) setSelectedGroupId(list[0].id);
      else setShowNewGroup(true);
    } else {
      setShowNewGroup(true);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToAudience() {
    if (!destination.trim() || !when) return;
    setStep("audience");
  }

  async function submit() {
    if (!userId) return;
    setSubmitting(true);

    let groupId = selectedGroupId;

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
      groupId = group.id;
    }

    if (!groupId) {
      setSubmitting(false);
      await modal.alert("Choose a group, or create one, before continuing.");
      return;
    }

    const { data: request, error } = await supabase
      .from("vuma_private_trip_requests")
      .insert({
        group_id: groupId,
        requested_by: userId,
        destination_address: destination.trim(),
        needed_at: new Date(when).toISOString(),
        seats_needed: seats,
        note: note.trim() || null,
        status: "open",
        visibility,
      })
      .select()
      .single();

    setSubmitting(false);
    if (error) {
      await modal.alert(`Could not post request: ${error.message}`);
      return;
    }
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
            <div>
              <label className="label block mb-1">Destination</label>
              <input className="input" placeholder="Where to" value={destination} onChange={(e) => setDestination(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label block mb-1">When</label>
                <input type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
              <div>
                <label className="label block mb-1">Seats needed</label>
                <input type="number" min={1} className="input" value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
              </div>
            </div>
            <div>
              <label className="label block mb-1">Note (optional)</label>
              <input className="input" placeholder="e.g. Going for church, can help with fuel" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button className="btn-primary w-full" disabled={!destination.trim() || !when} onClick={goToAudience}>
              Next: who should see this?
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold text-navy-800">Who should see this?</h1>
              <p className="text-xs text-navy-400 mt-1">Pick a group, or create one if you don't have one yet.</p>
            </div>

            {!showNewGroup && groups.length > 0 && (
              <div className="space-y-2">
                {groups.map((g) => (
                  <label key={g.id} className={`card p-4 flex items-center gap-3 cursor-pointer ${selectedGroupId === g.id ? "border-jade-400" : ""}`}>
                    <input
                      type="radio"
                      name="group"
                      className="w-4 h-4 accent-gold-400"
                      checked={selectedGroupId === g.id}
                      onChange={() => setSelectedGroupId(g.id)}
                    />
                    <span className="text-sm font-medium text-navy-700">{g.name}</span>
                  </label>
                ))}
                <button className="text-xs text-navy-400 underline" onClick={() => setShowNewGroup(true)}>
                  Or create a new group instead
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
                    Use an existing group instead
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
                <span className="font-semibold">Also show to all Vuma Private members</span>, not just this group — off
                by default.
              </span>
            </label>

            <button
              className="btn-primary w-full"
              disabled={submitting || (showNewGroup ? !newGroupName.trim() : !selectedGroupId)}
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
