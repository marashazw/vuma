"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import type { VumaPrivateTripRequest, VumaPrivateTripOffer, Profile } from "@/lib/types";
import { Loader2, ArrowLeft, MapPin, Users2, Calendar, Check, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function TripRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: requestId } = use(params);
  const supabase = createClient();
  const modal = useModal();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [request, setRequest] = useState<(VumaPrivateTripRequest & { requester?: Profile }) | null>(null);
  const [offers, setOffers] = useState<(VumaPrivateTripOffer & { driver?: Profile })[]>([]);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [seats, setSeats] = useState(1);
  const [totalCost, setTotalCost] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data: r } = await supabase.from("vuma_private_trip_requests").select("*").eq("id", requestId).single();
    const { data: requesterProfile } = await supabase.from("profiles").select("*").eq("id", r?.requested_by).single();
    setRequest(r ? { ...r, requester: requesterProfile as Profile } : null);

    const { data: offerData } = await supabase
      .from("vuma_private_trip_offers")
      .select("*")
      .eq("trip_request_id", requestId)
      .order("created_at", { ascending: false });
    const driverIds = [...new Set((offerData || []).map((o) => o.driver_id))];
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", driverIds.length ? driverIds : ["-"]);
    setOffers((offerData || []).map((o: any) => ({ ...o, driver: (profiles as Profile[] || []).find((p) => p.id === o.driver_id) })));

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  // Mirrors the no_markup check constraint in the database — this is a
  // helpful, immediate calculation for the person filling in the form,
  // not the actual enforcement boundary. The database constraint is what
  // genuinely prevents a markup from ever being stored, even if this
  // client-side number were bypassed somehow.
  const maxFairSplit = totalCost && seats ? Number(totalCost) / (seats + 1) : 0;
  const suggestedSplit = Math.round(maxFairSplit * 100) / 100;

  async function submitOffer() {
    if (!userId || !request || !totalCost || Number(totalCost) <= 0) return;
    setSubmitting(true);
    const { error } = await supabase.from("vuma_private_trip_offers").insert({
      trip_request_id: requestId,
      driver_id: userId,
      seats_available: seats,
      estimated_total_cost: Number(totalCost),
      cost_per_person: suggestedSplit,
      note: note.trim() || null,
      status: "offered",
    });
    setSubmitting(false);
    if (error) {
      await modal.alert(`Could not submit offer: ${error.message}`);
      return;
    }
    setTotalCost("");
    setSeats(1);
    setNote("");
    setShowOfferForm(false);
    await load();
  }

  async function acceptOffer(offer: VumaPrivateTripOffer) {
    const ok = await modal.confirm(
      `Accept this offer? ${offer.seats_available} seat(s) at ${request?.requested_by ? "" : ""}$${offer.cost_per_person.toFixed(2)} each. This locks the trip.`,
      { confirmLabel: "Accept & lock" }
    );
    if (!ok) return;
    setBusyOfferId(offer.id);
    await supabase.from("vuma_private_trip_offers").update({ status: "accepted" }).eq("id", offer.id);
    await supabase
      .from("vuma_private_trip_requests")
      .update({ status: "locked", accepted_offer_id: offer.id })
      .eq("id", requestId);
    setBusyOfferId(null);
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  if (!request) return null;

  const isRequester = userId === request.requested_by;
  const isLocked = request.status === "locked" || request.status === "completed";
  const acceptedOffer = offers.find((o) => o.id === request.accepted_offer_id);

  return (
    <div className="min-h-screen bg-paper">
      <header className="px-5 py-4 border-b border-navy-100 flex items-center gap-3">
        <Link href="/vuma-private" className="text-navy-400">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <p className="font-bold text-navy-800">Trip request</p>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">
        <div className="card p-5">
          <p className="font-semibold flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-navy-400" /> {request.destination_address}
          </p>
          <p className="text-sm text-navy-500 flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> {format(new Date(request.needed_at), "EEE d MMM, HH:mm")}
            </span>
            <span className="flex items-center gap-1">
              <Users2 className="w-3.5 h-3.5" /> {request.seats_needed} seat{request.seats_needed > 1 ? "s" : ""} needed
            </span>
          </p>
          {request.note && <p className="text-sm text-navy-500 mt-2">"{request.note}"</p>}
          <p className="text-xs text-navy-400 mt-2">
            Requested by {request.requester?.full_name || "Member"}
            {request.visibility === "platform" && " · shown to all Vuma Private members"}
          </p>
        </div>

        {isLocked && acceptedOffer && (
          <div className="card p-4 bg-jade-50 border-jade-200 flex items-start gap-2.5">
            <Check className="w-4 h-4 text-jade-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-jade-700">Trip locked</p>
              <p className="text-xs text-navy-500 mt-0.5">
                {acceptedOffer.driver?.full_name || "Driver"} — {acceptedOffer.seats_available} seat(s), $
                {acceptedOffer.cost_per_person.toFixed(2)} each
              </p>
            </div>
          </div>
        )}

        {!isRequester && !isLocked && (
          <div>
            {!showOfferForm ? (
              <button className="btn-primary w-full" onClick={() => setShowOfferForm(true)}>
                I'm going — offer a seat
              </button>
            ) : (
              <div className="card p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label block mb-1">Seats available</label>
                    <input type="number" min={1} className="input" value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="label block mb-1">Estimated total cost</label>
                    <input
                      type="number"
                      min={0}
                      className="input"
                      placeholder="Fuel, tolls, parking"
                      value={totalCost}
                      onChange={(e) => setTotalCost(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </div>
                </div>
                {totalCost !== "" && Number(totalCost) > 0 && (
                  <p className="text-xs text-navy-500 bg-navy-50 rounded-lg px-3 py-2">
                    Split {seats + 1} ways (you + {seats} passenger{seats > 1 ? "s" : ""}): <strong>${suggestedSplit.toFixed(2)} each</strong> — cost-share
                    only, no markup allowed.
                  </p>
                )}
                <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn-primary w-full" disabled={submitting || !totalCost || Number(totalCost) <= 0} onClick={submitOffer}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send offer"}
                </button>
              </div>
            )}
          </div>
        )}

        <div>
          <p className="label mb-3">Offers</p>
          {!offers.length && <p className="text-navy-400 text-sm">No offers yet.</p>}
          <div className="space-y-2">
            {offers.map((o) => (
              <div key={o.id} className={`card p-4 ${o.status === "accepted" ? "bg-jade-50 border-jade-200" : ""}`}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{o.driver?.full_name || "Member"}</p>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-navy-400">{o.status}</span>
                </div>
                <p className="text-sm text-navy-600 mt-1">
                  {o.seats_available} seat{o.seats_available > 1 ? "s" : ""} · ~${o.estimated_total_cost.toFixed(2)} total · $
                  {o.cost_per_person.toFixed(2)} each
                </p>
                {o.note && <p className="text-xs text-navy-400 mt-1">"{o.note}"</p>}
                {isRequester && request.status === "open" && o.status === "offered" && (
                  <button
                    className="btn-primary !text-sm w-full mt-3"
                    disabled={busyOfferId === o.id}
                    onClick={() => acceptOffer(o)}
                  >
                    {busyOfferId === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Accept & lock seats"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4 bg-navy-50 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-navy-400 mt-0.5 shrink-0" />
          <p className="text-xs text-navy-500">
            This connects members of a private group who already know each other. The requester is not
            employing a driver — a driver who offers is sharing the cost of a trip they were already
            planning to make.
          </p>
        </div>
      </div>
    </div>
  );
}
