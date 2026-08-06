"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatusPill } from "@/components/ui/StatusPill";
import { currencyFormat } from "@/lib/commission";
import { COUNTRIES } from "@/lib/constants";
import type { SubscriptionPlan, DriverSubscription, Profile, CountryCode, PaymentInstructions, ManualPaymentSubmission } from "@/lib/types";
import { Loader2, Plus, Save, Check, X, Paperclip, ExternalLink } from "lucide-react";
import { useModal } from "@/components/ui/ModalProvider";
import { format } from "date-fns";

export default function AdminSubscriptionsPage() {
  const modal = useModal();
  const supabase = createClient();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subs, setSubs] = useState<(DriverSubscription & { plan?: SubscriptionPlan; profile?: Profile })[]>([]);
  const [paymentInstructions, setPaymentInstructions] = useState<Record<string, PaymentInstructions>>({});
  const [manualPayments, setManualPayments] = useState<(ManualPaymentSubmission & { driver?: Profile; plan?: SubscriptionPlan })[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({
    name: "",
    country: "ZA" as CountryCode,
    period: "weekly" as "weekly" | "monthly" | "once_off",
    price: 0,
    currency: "ZAR",
    commission_pct_while_active: 0,
  });
  const [rejectReasonId, setRejectReasonId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});

  async function load() {
    const { data: plansData } = await supabase.from("subscription_plans").select("*").order("country");
    setPlans((plansData as SubscriptionPlan[]) || []);

    const { data: subsData } = await supabase
      .from("driver_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .order("created_at", { ascending: false })
      .limit(50);

    const driverIds = (subsData || []).map((s: any) => s.driver_id);
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", driverIds.length ? driverIds : ["-"]);

    setSubs(
      (subsData || []).map((s: any) => ({
        ...s,
        profile: (profiles || []).find((p) => p.id === s.driver_id),
      }))
    );

    const { data: instructionsData } = await supabase.from("payment_instructions").select("*");
    const map: Record<string, PaymentInstructions> = {};
    (instructionsData || []).forEach((i) => (map[i.country] = i as PaymentInstructions));
    setPaymentInstructions(map);

    const { data: manualData } = await supabase
      .from("manual_payment_submissions")
      .select("*, plan:subscription_plans(*)")
      .order("created_at", { ascending: false })
      .limit(50);
    const manualDriverIds = [...new Set((manualData || []).map((m) => m.driver_id))];
    const { data: manualProfiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", manualDriverIds.length ? manualDriverIds : ["-"]);
    setManualPayments(
      (manualData || []).map((m: any) => ({
        ...m,
        driver: (manualProfiles || []).find((p) => p.id === m.driver_id),
      }))
    );

    const withProof = (manualData || []).filter((m) => m.proof_of_payment_path);
    if (withProof.length) {
      const urls: Record<string, string> = {};
      for (const m of withProof) {
        const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(m.proof_of_payment_path, 600);
        if (data?.signedUrl) urls[m.id] = data.signedUrl;
      }
      setProofUrls(urls);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function waive(id: string) {
    setBusyId(id);
    await fetch(`/api/admin/subscriptions/${id}/waive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Waived from admin dashboard" }),
    });
    await load();
    setBusyId(null);
  }

  async function createPlan() {
    setBusyId("new");
    await fetch("/api/admin/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPlan),
    });
    setShowNewPlan(false);
    await load();
    setBusyId(null);
  }

  async function savePaymentInstructions(country: CountryCode) {
    const i = paymentInstructions[country];
    setBusyId(`pi-${country}`);
    await fetch("/api/admin/payment-instructions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country,
        method_label: i.method_label,
        account_name: i.account_name,
        account_number: i.account_number,
        instructions: i.instructions,
        link_url: i.link_url,
        link_label: i.link_label,
        gateway_enabled: i.gateway_enabled,
      }),
    });
    setBusyId(null);
  }

  async function approveManual(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/manual-payments/${id}/approve`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) await modal.alert(`Could not approve: ${data.error}`);
    await load();
    setBusyId(null);
  }

  async function rejectManual(id: string) {
    setBusyId(id);
    await fetch(`/api/admin/manual-payments/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason || "Rejected by admin" }),
    });
    setRejectReasonId(null);
    setRejectReason("");
    await load();
    setBusyId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  const pendingManual = manualPayments.filter((m) => m.status === "pending");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Subscriptions</h1>
        <button className="btn-dark" onClick={() => setShowNewPlan((v) => !v)}>
          <Plus className="w-4 h-4" /> New plan
        </button>
      </div>

      {showNewPlan && (
        <div className="card p-5 grid sm:grid-cols-3 gap-3">
          <input className="input" placeholder="Plan name" value={newPlan.name} onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))} />
          <select
            className="input"
            value={newPlan.country}
            onChange={(e) => setNewPlan((p) => ({ ...p, country: e.target.value as CountryCode, currency: COUNTRIES[e.target.value as CountryCode].currency }))}
          >
            {(Object.keys(COUNTRIES) as CountryCode[]).map((c) => (
              <option key={c} value={c}>
                {COUNTRIES[c].label}
              </option>
            ))}
          </select>
          <select className="input" value={newPlan.period} onChange={(e) => setNewPlan((p) => ({ ...p, period: e.target.value as any }))}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="once_off">Once-off</option>
          </select>
          <input
            className="input"
            type="number"
            placeholder="Price"
            value={newPlan.price}
            onChange={(e) => setNewPlan((p) => ({ ...p, price: Number(e.target.value) }))}
          />
          <input
            className="input"
            type="number"
            placeholder="Commission % while active"
            value={newPlan.commission_pct_while_active}
            onChange={(e) => setNewPlan((p) => ({ ...p, commission_pct_while_active: Number(e.target.value) }))}
          />
          <button className="btn-primary" onClick={createPlan} disabled={busyId === "new"}>
            {busyId === "new" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save plan"}
          </button>
        </div>
      )}

      {pendingManual.length > 0 && (
        <div>
          <p className="label mb-3">Pending manual payments ({pendingManual.length})</p>
          <div className="space-y-3">
            {pendingManual.map((m) => (
              <div key={m.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{m.driver?.full_name || "Driver"}</p>
                    <p className="text-xs text-navy-400">
                      {m.plan?.name} &middot; claimed {m.amount_claimed ? currencyFormat(m.amount_claimed, m.plan?.currency || "ZAR") : "—"}
                    </p>
                  </div>
                  <p className="text-xs text-navy-400">{format(new Date(m.created_at), "d MMM, HH:mm")}</p>
                </div>
                <div className="space-y-2 mb-3">
                  {m.reference_code && <p className="text-sm font-mono bg-navy-50 rounded px-3 py-2">Ref: {m.reference_code}</p>}
                  {m.proof_of_payment_path && (
                    <a
                      href={proofUrls[m.id] || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-gold-600 font-semibold underline"
                    >
                      <Paperclip className="w-3.5 h-3.5" /> View uploaded proof of payment
                    </a>
                  )}
                  {!m.reference_code && !m.proof_of_payment_path && (
                    <p className="text-sm text-navy-400">No reference or proof provided.</p>
                  )}
                </div>

                {rejectReasonId === m.id ? (
                  <div className="space-y-2">
                    <input
                      className="input text-sm"
                      placeholder="Reason for rejection"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button className="btn-ghost !py-2" onClick={() => setRejectReasonId(null)}>
                        Cancel
                      </button>
                      <button className="btn-danger !py-2" disabled={busyId === m.id} onClick={() => rejectManual(m.id)}>
                        Confirm reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button className="btn-ghost !py-2" disabled={busyId === m.id} onClick={() => setRejectReasonId(m.id)}>
                      <X className="w-4 h-4" /> Reject
                    </button>
                    <button className="btn-primary !py-2" disabled={busyId === m.id} onClick={() => approveManual(m.id)}>
                      {busyId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="label mb-3">Manual payment instructions (shown to drivers)</p>
        <div className="space-y-3">
          {(Object.keys(COUNTRIES) as CountryCode[]).map((c) => {
            const i = paymentInstructions[c];
            if (!i) return null;
            return (
              <div key={c} className="card p-4 space-y-2">
                <p className="font-semibold text-sm">{COUNTRIES[c].label}</p>
                <input
                  className="input text-sm"
                  placeholder="Method label (e.g. EcoCash)"
                  value={i.method_label || ""}
                  onChange={(e) => setPaymentInstructions((prev) => ({ ...prev, [c]: { ...i, method_label: e.target.value } }))}
                />
                <input
                  className="input text-sm"
                  placeholder="Account name"
                  value={i.account_name || ""}
                  onChange={(e) => setPaymentInstructions((prev) => ({ ...prev, [c]: { ...i, account_name: e.target.value } }))}
                />
                <input
                  className="input text-sm"
                  placeholder="Account / phone number"
                  value={i.account_number || ""}
                  onChange={(e) => setPaymentInstructions((prev) => ({ ...prev, [c]: { ...i, account_number: e.target.value } }))}
                />
                <input
                  className="input text-sm"
                  placeholder="Extra instructions shown to driver"
                  value={i.instructions || ""}
                  onChange={(e) => setPaymentInstructions((prev) => ({ ...prev, [c]: { ...i, instructions: e.target.value } }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input text-sm"
                    placeholder="Link label (e.g. Open EcoCash Web)"
                    value={i.link_label || ""}
                    onChange={(e) => setPaymentInstructions((prev) => ({ ...prev, [c]: { ...i, link_label: e.target.value } }))}
                  />
                  <input
                    className="input text-sm"
                    placeholder="https://..."
                    value={i.link_url || ""}
                    onChange={(e) => setPaymentInstructions((prev) => ({ ...prev, [c]: { ...i, link_url: e.target.value } }))}
                  />
                </div>
                {i.link_url && (
                  <p className="text-xs text-navy-400 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Drivers will see a clickable "{i.link_label || "Open payment link"}" link
                  </p>
                )}
                <label className="flex items-center gap-2 text-sm text-navy-600 bg-navy-50 rounded-lg px-3 py-2">
                  <input
                    type="checkbox"
                    checked={i.gateway_enabled}
                    onChange={(e) =>
                      setPaymentInstructions((prev) => ({ ...prev, [c]: { ...i, gateway_enabled: e.target.checked } }))
                    }
                  />
                  Show card / PayFast / EcoCash-Paynow payment option to drivers
                  {!i.gateway_enabled && <span className="text-coral-600 font-semibold ml-auto">Currently hidden</span>}
                </label>
                <button className="btn-dark !py-2" disabled={busyId === `pi-${c}`} onClick={() => savePaymentInstructions(c)}>
                  {busyId === `pi-${c}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="label mb-3">Plans</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {plans.map((p) => (
            <div key={p.id} className="card p-4">
              <p className="font-semibold text-sm">{p.name}</p>
              <p className="text-xs text-navy-400 mb-2">
                {COUNTRIES[p.country as CountryCode]?.label} &middot; {p.period}
              </p>
              <p className="fare-figure font-semibold">{currencyFormat(p.price, p.currency)}</p>
              <p className="text-xs text-navy-400 mt-1">{p.commission_pct_while_active}% commission while active</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="label mb-3">Driver subscriptions</p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-navy-400 border-b border-navy-100">
                <th className="p-4 font-medium">Driver</th>
                <th className="p-4 font-medium">Plan</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Ends</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-navy-50 last:border-0">
                  <td className="p-4">{s.profile?.full_name || "—"}</td>
                  <td className="p-4">{s.plan?.name}</td>
                  <td className="p-4">
                    <StatusPill status={s.status} />
                  </td>
                  <td className="p-4 text-navy-400">{format(new Date(s.ends_at), "d MMM yyyy")}</td>
                  <td className="p-4">
                    {s.status === "active" && (
                      <button className="btn-ghost !py-1.5 !px-3 text-xs" disabled={busyId === s.id} onClick={() => waive(s.id)}>
                        Waive fee
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!subs.length && (
                <tr>
                  <td className="p-4 text-navy-400" colSpan={5}>
                    No subscriptions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
