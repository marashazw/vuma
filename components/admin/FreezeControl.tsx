"use client";

import { useState } from "react";
import { useModal } from "@/components/ui/ModalProvider";
import { Snowflake, ShieldCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";

export function FreezeControl({
  profileId,
  role,
  suspendedUntil,
  suspensionReason,
  onUpdate,
}: {
  profileId: string;
  role: "rider" | "driver";
  suspendedUntil: string | null;
  suspensionReason: string | null;
  onUpdate: () => void | Promise<void>;
}) {
  const modal = useModal();
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");

  const isFrozen = !!suspendedUntil && new Date(suspendedUntil) > new Date();
  // A manual freeze uses a far-future date to represent "indefinite" —
  // anything more than a couple of years out is unambiguously a manual
  // freeze rather than a normal, time-bound automatic suspension.
  const isIndefinite = isFrozen && new Date(suspendedUntil!).getFullYear() > new Date().getFullYear() + 5;

  async function freeze() {
    if (!reason.trim()) return;
    setBusy(true);
    const res = await fetch("/api/admin/freeze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, role, reason: reason.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not freeze: ${data.error || "Unknown error"}`);
      return;
    }
    setShowForm(false);
    setReason("");
    await onUpdate();
  }

  async function unfreeze() {
    const ok = await modal.confirm(`Lift this ${role}'s suspension and restore normal access?`, {
      confirmLabel: "Yes, restore access",
    });
    if (!ok) return;
    setBusy(true);
    const res = await fetch("/api/admin/unfreeze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, role }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not unfreeze: ${data.error || "Unknown error"}`);
      return;
    }
    await onUpdate();
  }

  if (isFrozen) {
    return (
      <div className="card p-4 bg-coral-500/5 border-coral-500/20">
        <p className="text-sm font-semibold text-coral-700 flex items-center gap-1.5">
          <Snowflake className="w-4 h-4" /> {isIndefinite ? "Frozen by admin" : "Suspended"}
        </p>
        {suspensionReason && <p className="text-sm text-navy-600 mt-1">{suspensionReason}</p>}
        {!isIndefinite && suspendedUntil && (
          <p className="text-xs text-navy-400 mt-1">Until {format(new Date(suspendedUntil), "d MMM yyyy, HH:mm")}</p>
        )}
        <button className="btn-primary w-full mt-3 !text-sm" disabled={busy} onClick={unfreeze}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Restore access
        </button>
      </div>
    );
  }

  return (
    <div className="card p-4">
      {!showForm ? (
        <button className="btn-ghost w-full !text-sm !text-coral-600" onClick={() => setShowForm(true)}>
          <Snowflake className="w-4 h-4" /> Freeze account while investigating
        </button>
      ) : (
        <div className="space-y-2">
          <label className="label block">Reason (kept on file, shown to the account holder)</label>
          <input
            className="input text-sm"
            placeholder="e.g. Suspicious change-credit pattern under review"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost !text-sm" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button className="btn-danger !text-sm" disabled={busy || !reason.trim()} onClick={freeze}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Freeze now"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
