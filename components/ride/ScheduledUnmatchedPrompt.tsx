"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import type { Ride } from "@/lib/types";
import { AlertTriangle, Loader2 } from "lucide-react";

export function ScheduledUnmatchedPrompt({ ride, onUpdate }: { ride: Ride; onUpdate: () => void | Promise<void> }) {
  const supabase = createClient();
  const modal = useModal();
  const [busy, setBusy] = useState(false);

  const isUnmatchedAndOverdue =
    ride.is_scheduled &&
    !!ride.scheduled_at &&
    new Date(ride.scheduled_at).getTime() <= Date.now() &&
    (ride.status === "requested" || ride.status === "negotiating");

  if (!isUnmatchedAndOverdue) return null;

  async function keepOpen() {
    setBusy(true);
    // Converts it to a normal, immediate request — no driver ever matched
    // it in time, so the "scheduled for later" framing no longer serves
    // any purpose. From here it behaves exactly like any other open
    // request: visible normally on the driver feed, no longer buried
    // behind a scheduled time that's already passed.
    const { error } = await supabase.from("rides").update({ is_scheduled: false }).eq("id", ride.id);
    setBusy(false);
    if (error) {
      await modal.alert(`Could not update this request: ${error.message}`);
      return;
    }
    await onUpdate();
  }

  async function cancel() {
    setBusy(true);
    await fetch(`/api/rides/${ride.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Scheduled time passed with no driver found" }),
    });
    setBusy(false);
    await onUpdate();
  }

  return (
    <div className="card p-4 bg-gold-50 border-gold-200">
      <p className="text-sm font-semibold text-gold-700 flex items-center gap-1.5">
        <AlertTriangle className="w-4 h-4" /> Your scheduled time has passed without a driver
      </p>
      <p className="text-xs text-navy-500 mt-1">
        No driver was matched in time. You can keep this request open now — it'll behave like a normal, immediate
        request — or cancel it.
      </p>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button className="btn-ghost !text-sm" disabled={busy} onClick={cancel}>
          Cancel request
        </button>
        <button className="btn-primary !text-sm" disabled={busy} onClick={keepOpen}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Keep it open"}
        </button>
      </div>
    </div>
  );
}
