"use client";

import { useState } from "react";
import { useModal } from "@/components/ui/ModalProvider";
import type { Ride } from "@/lib/types";
import { CalendarClock, AlertTriangle, Loader2 } from "lucide-react";

const LOCK_WINDOW_MS = 60 * 60 * 1000;
const NO_SHOW_GRACE_MS = 10 * 60 * 1000; // matches TripReminder's own threshold

export function ScheduledCancelPanel({
  ride,
  currentUserId,
  isDriver,
  onUpdate,
}: {
  ride: Ride;
  currentUserId: string;
  isDriver: boolean;
  onUpdate: () => void | Promise<void>;
}) {
  const modal = useModal();
  const [busy, setBusy] = useState(false);
  const [showProposeForm, setShowProposeForm] = useState(false);
  const [reason, setReason] = useState("");

  if (!ride.is_scheduled || !ride.scheduled_at || ride.status !== "accepted") return null;

  const scheduledTime = new Date(ride.scheduled_at).getTime();
  const withinLockWindow = scheduledTime - Date.now() <= LOCK_WINDOW_MS;
  const pastGracePeriod = Date.now() - scheduledTime > NO_SHOW_GRACE_MS;
  const pastScheduledTime = Date.now() >= scheduledTime;
  const isProposer = ride.scheduled_cancel_proposed_by === currentUserId;

  // For the rider, the brief window between the scheduled time passing
  // and the grace period ending has nothing valid to offer here — no
  // cancel (removed above), no report-no-show yet (still within grace).
  // TripReminder's own dashboard dialog already covers exactly this
  // window ("Is your driver here?"), so an empty-looking card here would
  // be worse than not rendering at all. Exception: a rejected proposal
  // they made themselves still needs resolving regardless of this
  // window's timing — that choice shouldn't be suppressed just because
  // it happens to coincide with it.
  const hasRejectedProposalToResolve = ride.scheduled_cancel_status === "rejected" && isProposer;
  if (!isDriver && pastScheduledTime && !pastGracePeriod && !hasRejectedProposalToResolve) return null;

  async function acknowledgeRejection() {
    setBusy(true);
    const res = await fetch(`/api/rides/${ride.id}/acknowledge-rejection`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not proceed: ${data.error || "Unknown error"}`);
      return;
    }
    await onUpdate();
  }

  async function cancelAnyway() {
    const ok = await modal.confirm(
      "The other side declined your cancellation request. Cancelling anyway will flag your account, regardless of how far in advance this is — deliberately overriding an explicit objection is treated differently from an ordinary cancellation. Are you sure?",
      { confirmLabel: "Yes, cancel anyway", danger: true }
    );
    if (!ok) return;

    setBusy(true);
    const res = await fetch(`/api/rides/${ride.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: isDriver ? "Driver cancelled despite rider declining the cancellation proposal" : "Rider cancelled despite driver declining the cancellation proposal",
        forceFlag: true,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not cancel: ${data.error || "Unknown error"}`);
      return;
    }
    await onUpdate();
  }

  async function proposeCancel() {
    if (!reason.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/rides/${ride.id}/propose-cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not propose cancellation: ${data.error || "Unknown error"}`);
      return;
    }
    setShowProposeForm(false);
    setReason("");
    await onUpdate();
  }

  async function respond(accept: boolean) {
    setBusy(true);
    const res = await fetch(`/api/rides/${ride.id}/respond-cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not respond: ${data.error || "Unknown error"}`);
      return;
    }
    await onUpdate();
  }

  async function directCancel(isNoShowReport = false) {
    const consequence = isNoShowReport
      ? "This will flag the driver's account. A second flag within 3 months results in a 7-day suspension for them."
      : isDriver
      ? withinLockWindow
        ? "This will flag your account. A second flag within 3 months results in a 7-day suspension."
        : null
      : withinLockWindow
      ? "This is within 1 hour of the scheduled time — cancelling will flag your account. A second flag within 3 months results in a 7-day suspension."
      : null;

    const ok = await modal.confirm(
      consequence
        ? `${consequence} Are you sure you want to cancel?`
        : "Cancel this scheduled ride? Since it's well ahead of the scheduled time, no consequence applies.",
      { confirmLabel: "Yes, cancel", danger: true }
    );
    if (!ok) return;

    setBusy(true);
    const res = await fetch(`/api/rides/${ride.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: isNoShowReport ? "Reported no-show" : isDriver ? "Driver cancelled" : "Rider cancelled",
        noShowReport: isNoShowReport,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not cancel: ${data.error || "Unknown error"}`);
      return;
    }
    await onUpdate();
  }

  if (ride.scheduled_cancel_status === "rejected" && isProposer) {
    return (
      <div className="card p-4 bg-coral-500/5 border-coral-500/20 space-y-3">
        <p className="text-sm font-semibold text-coral-700 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" /> {isDriver ? "The rider" : "The driver"} declined your cancellation request
        </p>
        <p className="text-xs text-navy-500">You can proceed with the trip as scheduled, or cancel anyway — which will flag your account.</p>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-ghost !text-sm !text-coral-600" disabled={busy} onClick={cancelAnyway}>
            Cancel anyway
          </button>
          <button className="btn-primary !text-sm" disabled={busy} onClick={acknowledgeRejection}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Proceed with trip"}
          </button>
        </div>
      </div>
    );
  }

  if (ride.scheduled_cancel_status === "rejected" && !isProposer) {
    return (
      <div className="card p-4 bg-navy-50 text-sm text-navy-500">
        You declined {isDriver ? "the rider's" : "the driver's"} cancellation request — the trip continues as
        scheduled, unless {isDriver ? "the rider" : "the driver"} decides to cancel anyway.
      </div>
    );
  }

  if (ride.scheduled_cancel_status === "proposed" && !isProposer) {
    return (
      <div className="card p-4 bg-gold-50 border-gold-200 space-y-3">
        <p className="text-sm font-semibold text-gold-700 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" /> {isDriver ? "The rider" : "The driver"} wants to cancel this trip
        </p>
        <p className="text-sm text-navy-600">Reason: {ride.scheduled_cancel_reason}</p>
        <p className="text-xs text-navy-400">Agreeing cancels the trip with no penalty to either side.</p>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-ghost" disabled={busy} onClick={() => respond(false)}>
            Reject
          </button>
          <button className="btn-primary" disabled={busy} onClick={() => respond(true)}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Accept cancellation"}
          </button>
        </div>
      </div>
    );
  }

  if (ride.scheduled_cancel_status === "proposed" && isProposer) {
    return (
      <div className="card p-4 bg-navy-50 text-sm text-navy-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Waiting for {isDriver ? "the rider" : "the driver"} to respond to
        your cancellation request.
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-3">
      <p className="text-xs text-navy-400 flex items-center gap-1.5">
        <CalendarClock className="w-3.5 h-3.5" /> Need to cancel this scheduled trip?
      </p>
      {!showProposeForm ? (
        <div className="grid grid-cols-1 gap-2">
          {(isDriver || !pastScheduledTime) && (
            <button className="btn-ghost !text-sm" onClick={() => setShowProposeForm(true)}>
              Propose cancelling (needs the other side to agree — no penalty either way)
            </button>
          )}
          {!isDriver && pastGracePeriod && (
            <button className="btn-ghost !text-sm !text-coral-600" disabled={busy} onClick={() => directCancel(true)}>
              Driver didn't show up — report no-show
            </button>
          )}
          {(isDriver || !pastScheduledTime) && (
            <button className="btn-ghost !text-sm !text-coral-600" disabled={busy} onClick={() => directCancel(false)}>
              Cancel directly {withinLockWindow ? "(consequences apply)" : ""}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <input
            className="input text-sm"
            placeholder="Reason (e.g. flight delay, feeling unwell)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost !text-sm" onClick={() => setShowProposeForm(false)}>
              Back
            </button>
            <button className="btn-primary !text-sm" disabled={busy || !reason.trim()} onClick={proposeCancel}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send request"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
