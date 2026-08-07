"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import type { Profile } from "@/lib/types";
import { Loader2, Check, X, ShieldAlert } from "lucide-react";
import { format } from "date-fns";

interface Appeal {
  id: string;
  profile_id: string;
  role: "driver" | "rider";
  reason: string;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  created_at: string;
}

export default function AdminAppealsPage() {
  const supabase = createClient();
  const modal = useModal();
  const [appeals, setAppeals] = useState<(Appeal & { person?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesId, setNotesId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  async function load() {
    const { data } = await supabase.from("suspension_appeals").select("*").order("created_at", { ascending: false });
    const list = (data as Appeal[]) || [];
    const ids = [...new Set(list.map((a) => a.profile_id))];
    const { data: people } = await supabase.from("profiles").select("*").in("id", ids.length ? ids : ["-"]);
    setAppeals(list.map((a) => ({ ...a, person: (people as Profile[] || []).find((p) => p.id === a.profile_id) })));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decide(id: string, approve: boolean) {
    setBusyId(id);
    const res = await fetch(`/api/appeals/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve, adminNotes: notes || null }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not process: ${data.error || "Unknown error"}`);
      return;
    }
    setNotesId(null);
    setNotes("");
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  const pending = appeals.filter((a) => a.status === "pending");
  const reviewed = appeals.filter((a) => a.status !== "pending").slice(0, 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Suspension Appeals</h1>
        <p className="text-navy-400 text-sm mt-1">
          Riders and drivers suspended for a repeat scheduled-ride flag can appeal here. You have final discretion.
        </p>
      </div>

      <div>
        <p className="label mb-3">Pending ({pending.length})</p>
        {!pending.length && <p className="text-navy-400 text-sm">Nothing waiting on review.</p>}
        <div className="space-y-3">
          {pending.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-coral-500" /> {a.person?.full_name || "Unknown"}{" "}
                  <span className="text-xs text-navy-400 capitalize font-normal">({a.role})</span>
                </p>
                <p className="text-xs text-navy-400">{format(new Date(a.created_at), "d MMM yyyy, HH:mm")}</p>
              </div>
              <p className="text-sm text-navy-600 bg-navy-50 rounded-lg px-3 py-2 mb-3">{a.reason}</p>

              {notesId === a.id ? (
                <div className="space-y-2">
                  <input
                    className="input text-sm"
                    placeholder="Notes (optional, kept on file)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <button className="btn-danger" disabled={busyId === a.id} onClick={() => decide(a.id, false)}>
                      <X className="w-4 h-4" /> Confirm reject
                    </button>
                    <button className="btn-primary" disabled={busyId === a.id} onClick={() => decide(a.id, true)}>
                      {busyId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirm approve
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn-ghost w-full text-sm" onClick={() => setNotesId(a.id)}>
                  Review with notes
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-navy-100 pt-6">
        <p className="label mb-3">Recently reviewed</p>
        {!reviewed.length && <p className="text-navy-400 text-sm">Nothing reviewed yet.</p>}
        <div className="space-y-2">
          {reviewed.map((a) => (
            <div key={a.id} className="card p-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">
                  {a.person?.full_name || "Unknown"} <span className="text-xs text-navy-400 capitalize">({a.role})</span>
                </p>
                <p className="text-xs text-navy-400">{format(new Date(a.created_at), "d MMM yyyy, HH:mm")}</p>
              </div>
              <span className={`text-xs font-semibold ${a.status === "approved" ? "text-jade-600" : "text-coral-600"}`}>
                {a.status === "approved" ? "Approved" : "Rejected"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
