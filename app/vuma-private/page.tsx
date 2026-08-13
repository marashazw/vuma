"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import type { VumaPrivateGroup, VumaAssociateMembership } from "@/lib/types";
import { Loader2, Users, Plus, LogIn, Copy, Check, ArrowRight, ShieldCheck, Globe2 } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

export default function VumaPrivateHubPage() {
  const supabase = createClient();
  const modal = useModal();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [membership, setMembership] = useState<VumaAssociateMembership | null>(null);
  const [groups, setGroups] = useState<VumaPrivateGroup[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data: mem } = await supabase
      .from("vuma_associates_memberships")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle();
    setMembership(mem as VumaAssociateMembership | null);

    const { data: memberships } = await supabase.from("vuma_private_group_members").select("group_id").eq("profile_id", user.id);
    const groupIds = (memberships || []).map((m) => m.group_id);
    if (groupIds.length) {
      const { data: groupData } = await supabase.from("vuma_private_groups").select("*").in("id", groupIds).order("created_at", { ascending: false });
      setGroups((groupData as VumaPrivateGroup[]) || []);
    } else {
      setGroups([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function generateInviteCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  async function createGroup() {
    if (!groupName.trim() || !userId) return;
    setBusy(true);
    const inviteCode = generateInviteCode();
    const { data: group, error } = await supabase
      .from("vuma_private_groups")
      .insert({ name: groupName.trim(), description: groupDesc.trim() || null, invite_code: inviteCode, created_by: userId })
      .select()
      .single();
    if (error) {
      setBusy(false);
      await modal.alert(`Could not create group: ${error.message}`);
      return;
    }
    await supabase.from("vuma_private_group_members").insert({ group_id: group.id, profile_id: userId });
    setBusy(false);
    setGroupName("");
    setGroupDesc("");
    setShowCreate(false);
    await load();
  }

  async function joinGroup() {
    if (!joinCode.trim() || !userId) return;
    setBusy(true);
    const { data: group } = await supabase.from("vuma_private_groups").select("id").eq("invite_code", joinCode.trim().toUpperCase()).maybeSingle();
    if (!group) {
      setBusy(false);
      await modal.alert("No group found with that invite code — double check it and try again.");
      return;
    }
    const { error } = await supabase.from("vuma_private_group_members").insert({ group_id: group.id, profile_id: userId });
    setBusy(false);
    if (error) {
      await modal.alert(error.code === "23505" ? "You're already a member of that group." : `Could not join: ${error.message}`);
      return;
    }
    setJoinCode("");
    setShowJoin(false);
    await load();
  }

  function copyCode(group: VumaPrivateGroup) {
    navigator.clipboard.writeText(group.invite_code);
    setCopiedId(group.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function toggleCooption() {
    if (!membership) return;
    const newValue = !membership.auto_accept_cooption;
    await supabase.from("vuma_associates_memberships").update({ auto_accept_cooption: newValue }).eq("id", membership.id);
    setMembership({ ...membership, auto_accept_cooption: newValue });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-5">
        <div className="card p-6 max-w-sm text-center">
          <p className="text-sm text-navy-600 mb-3">Log in to use Vuma Private.</p>
          <Link href="/login" className="btn-primary w-full">
            Log in
          </Link>
        </div>
      </div>
    );
  }

  if (membership?.status !== "active") {
    return (
      <div className="min-h-screen bg-paper px-5 py-10">
        <div className="max-w-md mx-auto">
          <div className="flex justify-center mb-6">
            <Logo />
          </div>
          <div className="card p-6 text-center">
            <Users className="w-10 h-10 text-gold-500 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-navy-800 mb-2">Vuma Private</h1>
            <p className="text-sm text-navy-500 mb-1">
              A private cost-sharing club. Ask your own circle — a church group, a workplace, a school run —
              who's already going and has space. Not a way to hire a driver: a driver already making a trip
              shares the actual cost with others in their group.
            </p>
            <p className="text-xs text-navy-400 mb-5">
              {membership?.status === "pending"
                ? "Your membership is awaiting confirmation — you'll get access once it's active."
                : "Membership is required to create or join a group."}
            </p>
            {!membership && (
              <Link href="/vuma-associates/constitution" className="btn-primary w-full">
                Learn more &amp; join
              </Link>
            )}
            {membership?.status === "pending" && (
              <Link href="/rider" className="btn-primary w-full">
                Back to book a ride
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="px-5 py-4 border-b border-navy-100 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <Link href="/vuma-private/wallet" className="text-xs text-navy-400 hover:text-navy-600 flex items-center gap-1">
            Wallet
          </Link>
          <Link href="/rider" className="text-xs text-navy-400 hover:text-navy-600 flex items-center gap-1">
            Switch to regular Vuma <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-jade-500" /> Vuma Private
          </h1>
          <p className="text-navy-400 text-sm mt-1">Your groups — private circles for cost-sharing trips.</p>
        </div>

        <label className="card p-4 flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 mt-0.5 shrink-0 accent-gold-400"
            checked={membership?.auto_accept_cooption || false}
            onChange={toggleCooption}
          />
          <span className="text-xs text-navy-600">
            <span className="font-semibold">Let other members add me to their group</span> — off by default. When
            on, any existing member of a group can add you directly, without needing your approval each time. You
            can turn this off again at any point.
          </span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <button className="btn-ghost !text-sm" onClick={() => (setShowCreate((s) => !s), setShowJoin(false))}>
            <Plus className="w-4 h-4" /> New group
          </button>
          <button className="btn-ghost !text-sm" onClick={() => (setShowJoin((s) => !s), setShowCreate(false))}>
            <LogIn className="w-4 h-4" /> Join with code
          </button>
        </div>

        <Link href="/vuma-private/request" className="btn-primary w-full flex items-center justify-center gap-1.5">
          Need Help With A Trip?
        </Link>

        <Link href="/vuma-private/feed" className="btn-ghost w-full !text-sm flex items-center justify-center gap-1.5">
          <Globe2 className="w-4 h-4" /> See Vuma Private-wide requests
        </Link>

        {showCreate && (
          <div className="card p-5 space-y-3">
            <input className="input" placeholder="Group name (e.g. St. Mary's Church Group)" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            <input className="input" placeholder="Description (optional)" value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} />
            <button className="btn-primary w-full" disabled={busy || !groupName.trim()} onClick={createGroup}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create group"}
            </button>
          </div>
        )}

        {showJoin && (
          <div className="card p-5 space-y-3">
            <input className="input uppercase" placeholder="Invite code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
            <button className="btn-primary w-full" disabled={busy || !joinCode.trim()} onClick={joinGroup}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join group"}
            </button>
          </div>
        )}

        <div>
          <p className="label mb-3">Your groups</p>
          {!groups.length && <p className="text-navy-400 text-sm">You haven't joined or created a group yet.</p>}
          <div className="space-y-2">
            {groups.map((g) => (
              <div key={g.id} className="card p-4">
                <Link href={`/vuma-private/groups/${g.id}`} className="block mb-2">
                  <p className="font-semibold text-navy-800">{g.name}</p>
                  {g.description && <p className="text-xs text-navy-400 mt-0.5">{g.description}</p>}
                </Link>
                <div className="flex items-center justify-between">
                  <Link href={`/vuma-private/groups/${g.id}`} className="text-xs font-semibold text-jade-600 flex items-center gap-1">
                    Open group <ArrowRight className="w-3 h-3" />
                  </Link>
                  <button className="text-xs text-navy-400 flex items-center gap-1" onClick={() => copyCode(g)}>
                    {copiedId === g.id ? <Check className="w-3 h-3 text-jade-600" /> : <Copy className="w-3 h-3" />} {g.invite_code}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
