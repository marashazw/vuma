"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatusPill } from "@/components/ui/StatusPill";
import { currencyFormat } from "@/lib/commission";
import type { Ride } from "@/lib/types";
import Link from "next/link";
import { format } from "date-fns";
import { Loader2, Trash2, Check } from "lucide-react";
import { useModal } from "@/components/ui/ModalProvider";

export default function RideHistoryPage() {
  const supabase = createClient();
  const modal = useModal();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clearing, setClearing] = useState(false);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("rides")
      .select("*")
      .eq("rider_id", user.id)
      .eq("hidden_by_rider", false)
      .order("created_at", { ascending: false });
    setRides((data as Ride[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  async function clearSelected() {
    if (!selected.size) return;
    const ok = await modal.confirm(
      `Remove ${selected.size} trip${selected.size > 1 ? "s" : ""} from your history? This only clears them from your own list — nothing else is affected.`,
      { confirmLabel: "Clear" }
    );
    if (!ok) return;
    setClearing(true);
    const { error } = await supabase.from("rides").update({ hidden_by_rider: true }).in("id", Array.from(selected));
    setClearing(false);
    if (error) {
      await modal.alert(`Could not clear: ${error.message}`);
      return;
    }
    exitSelecting();
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your trips</h1>
        {!!rides.length && (
          <button
            className="text-sm font-semibold text-navy-500 hover:text-navy-700"
            onClick={() => (selecting ? exitSelecting() : setSelecting(true))}
          >
            {selecting ? "Cancel" : "Select"}
          </button>
        )}
      </div>

      {!rides.length && <p className="text-navy-400">No trips yet — your history will show up here.</p>}

      <ul className="space-y-3">
        {rides.map((r) => {
          const isSelected = selected.has(r.id);
          const card = (
            <div className="card p-4 flex items-center justify-between hover:border-gold-300 transition">
              <div className="flex items-center gap-3">
                {selecting && (
                  <span
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-gold-400 border-gold-400" : "border-navy-200"
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-navy-900" />}
                  </span>
                )}
                <div>
                  <p className="font-semibold text-sm">{r.dropoff_address.split(",")[0]}</p>
                  <p className="text-xs text-navy-400 mt-0.5">{format(new Date(r.created_at), "d MMM yyyy, HH:mm")}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="fare-figure font-semibold">
                  {currencyFormat(Number(r.final_fare ?? r.rider_offer), r.currency)}
                </p>
                <div className="mt-1">
                  <StatusPill status={r.status} />
                </div>
              </div>
            </div>
          );

          return (
            <li key={r.id}>
              {selecting ? (
                <button className="w-full text-left" onClick={() => toggleSelect(r.id)}>
                  {card}
                </button>
              ) : (
                <Link href={`/rider/rides/${r.id}`} className="block">
                  {card}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {selecting && selected.size > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 left-0 right-0 flex justify-center px-5 z-20">
          <button className="btn-danger shadow-lg" disabled={clearing} onClick={clearSelected}>
            {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Clear {selected.size} selected
          </button>
        </div>
      )}
    </div>
  );
}
