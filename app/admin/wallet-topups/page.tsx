"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import { currencyFormat } from "@/lib/commission";
import type { DriverWalletTopup, Profile } from "@/lib/types";
import { Loader2, Paperclip, Check, X } from "lucide-react";
import { format } from "date-fns";
import { BulkActionBar } from "@/components/admin/BulkActionBar";

export default function AdminWalletTopupsPage() {
  const supabase = createClient();
  const modal = useModal();
  const [topups, setTopups] = useState<(DriverWalletTopup & { driver?: Profile })[]>([]);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReasonId, setRejectReasonId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from("driver_wallet_topups").select("*").order("created_at", { ascending: false });
    const driverIds = [...new Set((data || []).map((t) => t.driver_id))];
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", driverIds.length ? driverIds : ["-"]);

    setTopups(
      (data || []).map((t: any) => ({
        ...t,
        driver: (profiles as Profile[] || []).find((p) => p.id === t.driver_id),
      }))
    );

    const withProof = (data || []).filter((t) => t.proof_of_payment_path);
    if (withProof.length) {
      const urls: Record<string, string> = {};
      for (const t of withProof) {
        const { data: signed } = await supabase.storage.from("wallet-proofs").createSignedUrl(t.proof_of_payment_path, 600);
        if (signed?.signedUrl) urls[t.id] = signed.signedUrl;
      }
      setProofUrls(urls);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approve(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/wallet-topups/${id}/approve`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) await modal.alert(`Could not approve: ${data.error}`);
    await load();
    setBusyId(null);
  }

  async function reject(id: string) {
    setBusyId(id);
    await fetch(`/api/admin/wallet-topups/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason || "Rejected by admin" }),
    });
    setRejectReasonId(null);
    setRejectReason("");
    await load();
    setBusyId(null);
  }

  async function bulkApprove() {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    for (const id of ids) {
      await fetch(`/api/admin/wallet-topups/${id}/approve`, { method: "POST" });
    }
    setBulkBusy(false);
    setSelected(new Set());
    await load();
  }

  async function bulkReject() {
    const ids = [...selected];
    if (!ids.length) return;
    const ok = await modal.confirm(`Reject ${ids.length} top-up${ids.length === 1 ? "" : "s"}?`, {
      confirmLabel: "Reject all",
      danger: true,
    });
    if (!ok) return;
    setBulkBusy(true);
    for (const id of ids) {
      await fetch(`/api/admin/wallet-topups/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Rejected by admin (bulk)" }),
      });
    }
    setBulkBusy(false);
    setSelected(new Set());
    await load();
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  const pending = topups.filter((t) => t.status === "pending");
  const reviewed = topups.filter((t) => t.status !== "pending").slice(0, 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Driver Wallet Top-ups</h1>
        <p className="text-navy-400 text-sm mt-1">
          Review and approve driver requests to top up their prepaid commission wallet.
        </p>
      </div>

      <div>
        <p className="label mb-3">Pending ({pending.length})</p>
        {!pending.length && <p className="text-navy-400 text-sm">Nothing waiting on review.</p>}
        {!!pending.length && (
          <BulkActionBar
            selectedCount={selected.size}
            totalCount={pending.length}
            allSelected={selected.size === pending.length}
            onToggleSelectAll={() => setSelected(selected.size === pending.length ? new Set() : new Set(pending.map((t) => t.id)))}
            actions={[
              { label: "Approve", onClick: bulkApprove, busy: bulkBusy },
              { label: "Reject", onClick: bulkReject, danger: true, busy: bulkBusy },
            ]}
          />
        )}
        <div className="space-y-3">
          {pending.map((t) => (
            <div key={t.id} className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-gold-400" checked={selected.has(t.id)} onChange={() => toggleOne(t.id)} />
                  <p className="font-semibold">{t.driver?.full_name || "Driver"}</p>
                </label>
                <p className="fare-figure text-lg font-bold">{currencyFormat(t.amount, t.currency)}</p>
              </div>
              <p className="text-xs text-navy-400 mb-3">{format(new Date(t.created_at), "d MMM yyyy, HH:mm")}</p>

              <div className="space-y-2 mb-3">
                {t.reference_code && <p className="text-sm font-mono bg-navy-50 rounded px-3 py-2">Ref: {t.reference_code}</p>}
                {t.proof_of_payment_path && (
                  <a
                    href={proofUrls[t.id] || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-gold-600 font-semibold underline"
                  >
                    <Paperclip className="w-3.5 h-3.5" /> View uploaded proof of payment
                  </a>
                )}
              </div>

              {rejectReasonId === t.id ? (
                <div className="space-y-2">
                  <input
                    className="input text-sm"
                    placeholder="Reason for rejecting (shown to driver)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <button className="btn-ghost" onClick={() => setRejectReasonId(null)}>
                      Cancel
                    </button>
                    <button className="btn-danger" disabled={busyId === t.id} onClick={() => reject(t.id)}>
                      Confirm reject
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button className="btn-danger" disabled={busyId === t.id} onClick={() => setRejectReasonId(t.id)}>
                    <X className="w-4 h-4" /> Reject
                  </button>
                  <button className="btn-primary" disabled={busyId === t.id} onClick={() => approve(t.id)}>
                    {busyId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-navy-100 pt-6">
        <p className="label mb-3">Recently reviewed</p>
        {!reviewed.length && <p className="text-navy-400 text-sm">Nothing reviewed yet.</p>}
        <div className="space-y-2">
          {reviewed.map((t) => (
            <div key={t.id} className="card p-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{t.driver?.full_name || "Driver"}</p>
                <p className="text-xs text-navy-400">{format(new Date(t.created_at), "d MMM yyyy, HH:mm")}</p>
              </div>
              <div className="text-right">
                <p className="fare-figure font-semibold">{currencyFormat(t.amount, t.currency)}</p>
                <span className={`text-xs font-semibold ${t.status === "approved" ? "text-jade-600" : "text-coral-600"}`}>
                  {t.status === "approved" ? "Approved" : "Rejected"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
