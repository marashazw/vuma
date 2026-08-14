"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import type { VumaPrivateGroup, VumaPrivateTripRequest, Profile } from "@/lib/types";
import { Loader2, Plus, ArrowLeft, MapPin, Users2, Calendar, UserPlus, Check, Clock } from "lucide-react";
import { format } from "date-fns";
import { BulkActionBar } from "@/components/ui/BulkActionBar";

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = use(params);
  const supabase = createClient();
  const modal = useModal();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [group, setGroup] = useState<VumaPrivateGroup | null>(null);
  const [requests, setRequests] = useState<(VumaPrivateTripRequest & { requester?: Profile })[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ destination: "", when: "", seats: 1, note: "", visibility: "group" as "group" | "platform" });
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [cooptableMembers, setCooptableMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [loadingCooptable, setLoadingCooptable] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data: g } = await supabase.from("vuma_private_groups").select("*").eq("id", groupId).single();
    setGroup(g as VumaPrivateGroup);

    const { data: reqs } = await supabase
      .from("vuma_private_trip_requests")
      .select("*")
      .eq("group_id", groupId)
      .order("needed_at", { ascending: true });
    const requesterIds = [...new Set((reqs || []).map((r) => r.requested_by))];
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", requesterIds.length ? requesterIds : ["-"]);
    setRequests(
      (reqs || []).map((r: any) => ({ ...r, requester: (profiles as Profile[] || []).find((p) => p.id === r.requested_by) }))
    );

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function postRequest() {
    if (!form.destination.trim() || !form.when || !userId) return;
    setSubmitting(true);
    const { error } = await supabase.from("vuma_private_trip_requests").insert({
      group_id: groupId,
      requested_by: userId,
      destination_address: form.destination.trim(),
      needed_at: new Date(form.when).toISOString(),
      seats_needed: form.seats,
      note: form.note.trim() || null,
      status: "open",
      visibility: form.visibility,
    });
    setSubmitting(false);
    if (error) {
      await modal.alert(`Could not post request: ${error.message}`);
      return;
    }
    setForm({ destination: "", when: "", seats: 1, note: "", visibility: "group" });
    setShowForm(false);
    await load();
  }

  async function openAddMembers() {
    setShowAddMembers(true);
    setLoadingCooptable(true);
    const res = await fetch("/api/vuma-private/cooptable-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });
    const data = await res.json();
    setLoadingCooptable(false);
    if (!res.ok) {
      await modal.alert(`Could not load members: ${data.error || "Unknown error"}`);
      return;
    }
    setCooptableMembers(data.members || []);
  }

  async function addMember(memberId: string) {
    setAddingId(memberId);
    const { error } = await supabase.from("vuma_private_group_members").insert({ group_id: groupId, profile_id: memberId });
    setAddingId(null);
    if (error) {
      await modal.alert(`Could not add member: ${error.message}`);
      return;
    }
    setAddedIds((prev) => new Set(prev).add(memberId));
  }

  function toggleMemberSelection(id: string) {
    const next = new Set(selectedMemberIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedMemberIds(next);
  }

  async function addSelectedMembers() {
    const ids = [...selectedMemberIds];
    if (!ids.length) return;
    setBulkAdding(true);
    let failures = 0;
    for (const id of ids) {
      const { error } = await supabase.from("vuma_private_group_members").insert({ group_id: groupId, profile_id: id });
      if (!error) setAddedIds((prev) => new Set(prev).add(id));
      else failures += 1;
    }
    setBulkAdding(false);
    setSelectedMemberIds(new Set());
    if (failures) {
      await modal.alert(`${ids.length - failures} added. ${failures} couldn't be added — they may have changed their preference since this list loaded.`);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    open: "bg-jade-50 border-jade-200 text-jade-700",
    locked: "bg-gold-50 border-gold-200 text-gold-700",
    completed: "bg-navy-50 border-navy-100 text-navy-500",
    cancelled: "bg-coral-50 border-coral-200 text-coral-600",
  };

  return (
    <div className="min-h-screen bg-paper">
      <header className="px-5 py-4 border-b border-navy-100 flex items-center gap-3">
        <Link href="/vuma-private" className="text-navy-400">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <p className="font-bold text-navy-800">{group?.name}</p>
          <p className="text-xs text-navy-400">Invite code: {group?.invite_code}</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">
        <button className="btn-primary w-full" onClick={() => setShowForm((s) => !s)}>
          <Plus className="w-4 h-4" /> {showForm ? "Cancel" : "Need Help With A Trip?"}
        </button>

        <button className="btn-ghost w-full !text-sm" onClick={() => (showAddMembers ? setShowAddMembers(false) : openAddMembers())}>
          <UserPlus className="w-4 h-4" /> {showAddMembers ? "Hide" : "Add members"}
        </button>

        {showAddMembers && (
          <div className="card p-5">
            <p className="text-xs text-navy-400 mb-3">
              Only members who've opted in to being added by anyone appear here — this doesn't require their
              individual approval each time, since they've already given standing consent.
            </p>
            {loadingCooptable ? (
              <div className="flex items-center gap-2 text-navy-300 py-4 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading&hellip;
              </div>
            ) : !cooptableMembers.length ? (
              <p className="text-navy-400 text-sm">No members are currently open to being added this way.</p>
            ) : (
              <div>
                {(() => {
                  const selectable = cooptableMembers.filter((m) => !addedIds.has(m.id));
                  return selectable.length > 0 ? (
                    <BulkActionBar
                      selectedCount={selectedMemberIds.size}
                      totalCount={selectable.length}
                      allSelected={selectedMemberIds.size === selectable.length}
                      onToggleSelectAll={() =>
                        setSelectedMemberIds(
                          selectedMemberIds.size === selectable.length ? new Set() : new Set(selectable.map((m) => m.id))
                        )
                      }
                      actions={[{ label: "Add selected", onClick: addSelectedMembers, busy: bulkAdding }]}
                    />
                  ) : null;
                })()}
                <div className="space-y-2">
                  {cooptableMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-3">
                      {!addedIds.has(m.id) && (
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-gold-400"
                          checked={selectedMemberIds.has(m.id)}
                          onChange={() => toggleMemberSelection(m.id)}
                        />
                      )}
                      <p className="text-sm text-navy-700 flex-1">{m.full_name}</p>
                      {addedIds.has(m.id) ? (
                        <span className="text-xs text-jade-600 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Added
                        </span>
                      ) : (
                        <button
                          className="btn-ghost !py-1.5 !px-3 !text-xs"
                          disabled={addingId === m.id}
                          onClick={() => addMember(m.id)}
                        >
                          {addingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {showForm && (
          <div className="card p-5 space-y-3">
            <p className="text-xs text-navy-400 -mt-1">
              Ask your group if anyone is driving and has space. You'll only split the actual fuel/toll costs.
              No fares, no profit.
            </p>
            <div>
              <label className="label block mb-1">Where to</label>
              <input className="input" placeholder="Destination" value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label block mb-1">When</label>
                <div className="flex gap-1.5">
                  <input
                    type="datetime-local"
                    className="input flex-1"
                    value={form.when}
                    onChange={(e) => setForm((f) => ({ ...f, when: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="btn-ghost !px-2.5"
                    title="Set to now"
                    onClick={() => {
                      const now = new Date();
                      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                      setForm((f) => ({ ...f, when: now.toISOString().slice(0, 16) }));
                    }}
                  >
                    <Clock className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="label block mb-1">Seats needed</label>
                <input type="number" min={1} className="input" value={form.seats} onChange={(e) => setForm((f) => ({ ...f, seats: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <label className="label block mb-1">Note to group</label>
              <input className="input" placeholder="e.g. Going for church, can help with fuel" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer bg-navy-50 rounded-lg px-3 py-2.5">
              <input
                type="checkbox"
                className="w-4 h-4 mt-0.5 shrink-0 accent-gold-400"
                checked={form.visibility === "platform"}
                onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.checked ? "platform" : "group" }))}
              />
              <span className="text-xs text-navy-600">
                <span className="font-semibold">Also show to all Vuma Private members</span>, not just this group — off
                by default. Nobody in this group offering to help yet? Widening this lets any active member across
                Vuma Private see and respond, not just people you already know.
              </span>
            </label>
            <button className="btn-primary w-full" disabled={submitting || !form.destination.trim() || !form.when} onClick={postRequest}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : form.visibility === "platform" ? "Ask My Group & Vuma Private" : "Ask My Group"}
            </button>
            <div className="bg-navy-50 rounded-lg p-3 text-xs text-navy-500 space-y-1">
              <p className="font-semibold text-navy-600">Group Rules:</p>
              <p>1. This is for members of your private group only.</p>
              <p>2. Drivers volunteer their own car and trip. No one can be "hired."</p>
              <p>3. Only actual costs are shared: fuel, tolls, parking.</p>
              <p>4. The driver is responsible for a valid licence and insurance.</p>
            </div>
          </div>
        )}

        <div>
          <p className="label mb-3">Trip requests</p>
          {!requests.length && <p className="text-navy-400 text-sm">No trip requests yet.</p>}
          <div className="space-y-2">
            {requests.map((r) => (
              <Link key={r.id} href={`/vuma-private/trip-requests/${r.id}`} className={`card p-4 block border ${statusColor[r.status]}`}>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <p className="font-semibold text-sm flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {r.pickup_address ? (
                        <>
                          From <span className="text-navy-500 font-normal">{r.pickup_address.split(",")[0]}</span> to {r.destination_address}
                        </>
                      ) : (
                        r.destination_address
                      )}
                    </span>
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.visibility === "platform" && (
                      <span className="text-[9px] font-bold uppercase tracking-wide bg-gold-100 text-gold-700 px-1.5 py-0.5 rounded">
                        Vuma Private-wide
                      </span>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wide">{r.status}</span>
                  </div>
                </div>
                <p className="text-xs flex items-center gap-3 opacity-80">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {format(new Date(r.needed_at), "d MMM, HH:mm")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users2 className="w-3 h-3" /> {r.seats_needed} seat{r.seats_needed > 1 ? "s" : ""}
                  </span>
                </p>
                <p className="text-xs opacity-70 mt-1">{r.requester?.full_name || "Member"}{r.note ? ` — ${r.note}` : ""}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
