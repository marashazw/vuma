"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import type { DriverNotice } from "@/lib/types";
import { Loader2, Plus, X, ExternalLink, Repeat, Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

const emptyForm = {
  label: "",
  title: "",
  body: "",
  link_url: "",
  link_label: "",
  position: "right" as "left" | "right",
  expires_at: "",
};

export default function AdminNoticesPage() {
  const supabase = createClient();
  const modal = useModal();
  const [notices, setNotices] = useState<DriverNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("driver_notices").select("*").order("created_at", { ascending: false });
    setNotices((data as DriverNotice[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function repost(n: DriverNotice) {
    setForm({
      label: n.label,
      title: n.title,
      body: n.body || "",
      link_url: n.link_url || "",
      link_label: n.link_label || "",
      position: n.position,
      expires_at: "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!form.label.trim() || !form.title.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/admin/notices/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not post: ${data.error || "Unknown error"}`);
      return;
    }
    setForm(emptyForm);
    setShowForm(false);
    await load();
  }

  async function deactivate(id: string) {
    const ok = await modal.confirm("Take this notice down? It'll stop showing to drivers immediately.", {
      confirmLabel: "Take it down",
    });
    if (!ok) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/notices/${id}/deactivate`, { method: "POST" });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not deactivate: ${data.error || "Unknown error"}`);
      return;
    }
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  const now = new Date();
  const isLive = (n: DriverNotice) => n.is_active && (!n.expires_at || new Date(n.expires_at) > now);
  const live = notices.filter(isLive);
  const past = notices.filter((n) => !isLive(n));

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Driver Dashboard Notices</h1>
          <p className="text-navy-400 text-sm mt-1">
            Shown in the side space on the driver dashboard (wide screens only). Nothing about the space itself is
            labelled — whatever heading you write here is all that shows.
          </p>
        </div>
        <button className="btn-primary !py-2 !px-3 shrink-0" onClick={() => (showForm ? setShowForm(false) : (setForm(emptyForm), setShowForm(true)))}>
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-3">
          <div>
            <label className="label block mb-1">Label</label>
            <input
              className="input"
              placeholder="e.g. Sponsored ad, Urgent notice, Vuma News"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>
          <div>
            <label className="label block mb-1">Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="label block mb-1">Body (optional)</label>
            <textarea className="input" rows={3} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1">Link URL (optional)</label>
              <input className="input" placeholder="https://…" value={form.link_url} onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))} />
            </div>
            <div>
              <label className="label block mb-1">Link text</label>
              <input className="input" placeholder="Learn more" value={form.link_label} onChange={(e) => setForm((f) => ({ ...f, link_label: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1">Position</label>
              <select className="input" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value as "left" | "right" }))}>
                <option value="right">Right side</option>
                <option value="left">Left side</option>
              </select>
            </div>
            <div>
              <label className="label block mb-1">Expires (optional)</label>
              <input
                type="date"
                className="input"
                value={form.expires_at}
                onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
              />
            </div>
          </div>
          <button className="btn-primary w-full" disabled={submitting || !form.label.trim() || !form.title.trim()} onClick={submit}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post to driver dashboard"}
          </button>
          <p className="text-xs text-navy-400">No expiry date means it runs until you take it down manually.</p>
        </div>
      )}

      <div>
        <p className="label mb-3 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-jade-600" /> Live now ({live.length})
        </p>
        {!live.length && <p className="text-navy-400 text-sm">Nothing currently showing.</p>}
        <div className="space-y-2">
          {live.map((n) => (
            <div key={n.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-gold-600 uppercase tracking-wide">{n.label}</p>
                  <p className="font-semibold text-sm text-navy-800">{n.title}</p>
                  {n.body && <p className="text-xs text-navy-500 mt-1">{n.body}</p>}
                  {n.link_url && (
                    <a href={n.link_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gold-600 flex items-center gap-1 mt-1">
                      {n.link_label || "Learn more"} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <p className="text-xs text-navy-400 mt-2 flex items-center gap-1 capitalize">
                    {n.position} side &middot; posted {format(new Date(n.created_at), "d MMM yyyy")}
                    {n.expires_at && (
                      <>
                        {" "}
                        &middot; <Clock className="w-3 h-3" /> expires {format(new Date(n.expires_at), "d MMM yyyy")}
                      </>
                    )}
                  </p>
                </div>
                <button className="btn-ghost !py-1.5 !px-2.5 text-xs shrink-0" disabled={busyId === n.id} onClick={() => deactivate(n.id)}>
                  {busyId === n.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Take down"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {past.length > 0 && (
        <div>
          <p className="label mb-3">Past ({past.length})</p>
          <div className="space-y-2">
            {past.map((n) => (
              <div key={n.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-navy-400 uppercase tracking-wide">{n.label}</p>
                    <p className="font-semibold text-sm text-navy-600">{n.title}</p>
                    <p className="text-xs text-navy-400 mt-1 capitalize">
                      {n.position} side &middot; posted {format(new Date(n.created_at), "d MMM yyyy")}
                      {!n.is_active ? " · taken down" : n.expires_at ? ` · expired ${format(new Date(n.expires_at), "d MMM yyyy")}` : ""}
                    </p>
                  </div>
                  <button className="btn-ghost !py-1.5 !px-2.5 text-xs shrink-0" onClick={() => repost(n)}>
                    <Repeat className="w-3.5 h-3.5" /> Repost
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
