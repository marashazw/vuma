"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import { COUNTRIES } from "@/lib/constants";
import type { ChargeType, CountryCode } from "@/lib/types";
import { Loader2, Plus, X, Power, Edit2, Check } from "lucide-react";
import { format } from "date-fns";

const emptyForm = {
  name: "",
  country: "ZA" as CountryCode,
  charge_kind: "percentage" as "percentage" | "flat",
  rate: "",
  flat_amount: "",
};

export default function AdminChargesPage() {
  const supabase = createClient();
  const modal = useModal();
  const [charges, setCharges] = useState<ChargeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  async function load() {
    const { data } = await supabase.from("charge_types").select("*").order("country").order("created_at", { ascending: false });
    setCharges((data as ChargeType[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    if (!form.name.trim()) return;
    if (form.charge_kind === "percentage" && !form.rate) return;
    if (form.charge_kind === "flat" && !form.flat_amount) return;

    setSubmitting(true);
    const res = await fetch("/api/admin/charges/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        country: form.country,
        charge_kind: form.charge_kind,
        rate: form.rate ? Number(form.rate) : null,
        flat_amount: form.flat_amount ? Number(form.flat_amount) : null,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not create charge: ${data.error || "Unknown error"}`);
      return;
    }
    setForm(emptyForm);
    setShowForm(false);
    await load();
  }

  async function toggle(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/charges/${id}/toggle`, { method: "POST" });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not update: ${data.error || "Unknown error"}`);
      return;
    }
    await load();
  }

  function startEdit(c: ChargeType) {
    setEditingId(c.id);
    setEditDraft(c.charge_kind === "percentage" ? String(c.rate ?? "") : String(c.flat_amount ?? ""));
  }

  async function saveEdit(c: ChargeType) {
    if (!editDraft) return;
    setBusyId(c.id);
    const res = await fetch(`/api/admin/charges/${c.id}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        c.charge_kind === "percentage" ? { rate: Number(editDraft) } : { flat_amount: Number(editDraft) }
      ),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not save: ${data.error || "Unknown error"}`);
      return;
    }
    setEditingId(null);
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  const byCountry: Record<string, ChargeType[]> = {};
  charges.forEach((c) => {
    byCountry[c.country] = byCountry[c.country] || [];
    byCountry[c.country].push(c);
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Taxes &amp; Levies</h1>
          <p className="text-navy-400 text-sm mt-1">
            Deducted from the driver at trip-start, alongside commission — applies whether the driver is on
            per-ride commission or an active subscription. Reported separately from Vuma's own revenue on the
            Income Statement, as due to the relevant regulator.
          </p>
        </div>
        <button className="btn-primary !py-2 !px-3 shrink-0" onClick={() => (showForm ? setShowForm(false) : (setForm(emptyForm), setShowForm(true)))}>
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-3">
          <div>
            <label className="label block mb-1">Name</label>
            <input
              className="input"
              placeholder="e.g. VAT, Road Fund Levy, Municipal Levy"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1">Country</label>
              <select className="input" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value as CountryCode }))}>
                <option value="ZA">South Africa</option>
                <option value="ZW">Zimbabwe</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="label block mb-1">Type</label>
              <select
                className="input"
                value={form.charge_kind}
                onChange={(e) => setForm((f) => ({ ...f, charge_kind: e.target.value as "percentage" | "flat" }))}
              >
                <option value="percentage">% of fare</option>
                <option value="flat">Flat amount</option>
              </select>
            </div>
          </div>
          {form.charge_kind === "percentage" ? (
            <div>
              <label className="label block mb-1">Rate (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder="e.g. 15"
                value={form.rate}
                onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
              />
            </div>
          ) : (
            <div>
              <label className="label block mb-1">Amount ({COUNTRIES[form.country].currencySymbol})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder="e.g. 2.00"
                value={form.flat_amount}
                onChange={(e) => setForm((f) => ({ ...f, flat_amount: e.target.value }))}
              />
            </div>
          )}
          <button className="btn-primary w-full" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add charge"}
          </button>
        </div>
      )}

      {!charges.length && <p className="text-navy-400 text-sm">No taxes or levies configured yet.</p>}

      {Object.entries(byCountry).map(([country, list]) => (
        <div key={country}>
          <p className="label mb-3">{COUNTRIES[country as CountryCode]?.label || country}</p>
          <div className="space-y-2">
            {list.map((c) => (
              <div key={c.id} className={`card p-4 flex items-center justify-between gap-3 ${!c.is_active ? "opacity-50" : ""}`}>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-navy-800">{c.name}</p>
                  {editingId === c.id ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number"
                        step="0.01"
                        className="input !py-1 !text-sm w-24"
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        autoFocus
                      />
                      <button className="text-jade-600" disabled={busyId === c.id} onClick={() => saveEdit(c)}>
                        {busyId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button className="text-navy-400" onClick={() => setEditingId(null)}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button className="text-xs text-navy-400 flex items-center gap-1 mt-0.5" onClick={() => startEdit(c)}>
                      {c.charge_kind === "percentage" ? `${c.rate}% of fare` : `${COUNTRIES[c.country].currencySymbol}${c.flat_amount} flat`}
                      <Edit2 className="w-3 h-3" />
                    </button>
                  )}
                  <p className="text-xs text-navy-300 mt-1">Added {format(new Date(c.created_at), "d MMM yyyy")}</p>
                </div>
                <button
                  className={`btn-ghost !py-1.5 !px-2.5 text-xs shrink-0 ${c.is_active ? "!text-coral-600" : "!text-jade-600"}`}
                  disabled={busyId === c.id}
                  onClick={() => toggle(c.id)}
                >
                  <Power className="w-3.5 h-3.5" /> {c.is_active ? "Deactivate" : "Activate"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
