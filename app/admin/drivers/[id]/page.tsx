"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatusPill } from "@/components/ui/StatusPill";
import { FreezeControl } from "@/components/admin/FreezeControl";
import type { DriverProfile, Profile } from "@/lib/types";
import { Loader2, ArrowLeft, FileText, CheckCircle2, XCircle, Sparkles, UserX } from "lucide-react";
import { useModal } from "@/components/ui/ModalProvider";
import { format } from "date-fns";

const DOC_FIELDS: { key: keyof DriverProfile; label: string }[] = [
  { key: "id_document_path", label: "Government-issued ID" },
  { key: "license_document_path", label: "Driver's license" },
  { key: "vehicle_registration_path", label: "Vehicle registration" },
  { key: "profile_photo_path", label: "Profile photo" },
  { key: "other_document_path", label: "Other (optional)" },
];

export default function AdminDriverReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const modal = useModal();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [deluxeNotes, setDeluxeNotes] = useState("");
  const [deluxeNextInspection, setDeluxeNextInspection] = useState("");
  const [deluxeBusy, setDeluxeBusy] = useState(false);

  async function load() {
    const { data: p } = await supabase.from("profiles").select("*").eq("id", id).single();
    const { data: dp } = await supabase.from("driver_profiles").select("*").eq("user_id", id).single();
    setProfile(p as Profile);
    setDriver(dp as DriverProfile);

    const urls: Record<string, string> = {};
    for (const field of DOC_FIELDS) {
      const path = (dp as any)?.[field.key];
      if (path) {
        const { data } = await supabase.storage.from("driver-documents").createSignedUrl(path, 600);
        if (data?.signedUrl) urls[field.key] = data.signedUrl;
      }
    }
    setSignedUrls(urls);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function decide(status: "verified" | "rejected") {
    setBusy(true);
    await fetch(`/api/admin/drivers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verification_status: status,
        rejection_reason: status === "rejected" ? reason : null,
      }),
    });
    await load();
    setBusy(false);
  }

  async function decideDeluxe(action: "certify" | "reject" | "expire") {
    setDeluxeBusy(true);
    await fetch(`/api/admin/drivers/${id}/deluxe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        nextInspectionDue: deluxeNextInspection ? new Date(deluxeNextInspection).toISOString() : null,
        notes: deluxeNotes || null,
      }),
    });
    await load();
    setDeluxeBusy(false);
  }

  async function convertToRider() {
    const ok = await modal.confirm(
      "Convert this account back to a rider? This will let them use the app as a rider again. Any driver history stays intact but hidden — this is meant for accounts mistakenly signed up as drivers.",
      { confirmLabel: "Convert to rider" }
    );
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/admin/drivers/${id}/convert-to-rider`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not convert: ${data.error || "Unknown error"}`);
      return;
    }
    router.push("/admin/drivers");
  }

  if (loading || !profile || !driver) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <Link href="/admin/drivers" className="inline-flex items-center gap-1.5 text-sm text-navy-400 hover:text-navy-600">
        <ArrowLeft className="w-4 h-4" /> Back to drivers
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{profile.full_name}</h1>
          <p className="text-navy-400 text-sm">{profile.phone || profile.email}</p>
        </div>
        <StatusPill status={driver.verification_status} />
      </div>

      {driver.submitted_at && (
        <p className="text-xs text-navy-400">Submitted for review {format(new Date(driver.submitted_at), "d MMM yyyy, HH:mm")}</p>
      )}

      <FreezeControl
        profileId={id}
        role="driver"
        suspendedUntil={driver.suspended_until}
        suspensionReason={driver.suspension_reason}
        onUpdate={load}
      />

      {!driver.submitted_at && driver.verification_status !== "verified" && (
        <div className="card p-4 bg-gold-50 border-gold-200 flex items-center justify-between gap-3">
          <p className="text-sm text-gold-700">
            No documents submitted yet — if this person meant to sign up as a rider (e.g. via a driver referral
            link by mistake), you can convert them back.
          </p>
          <button className="btn-ghost !py-2 !px-3 text-xs shrink-0" disabled={busy} onClick={convertToRider}>
            <UserX className="w-3.5 h-3.5" /> Convert to rider
          </button>
        </div>
      )}

      <div className="space-y-3">
        {DOC_FIELDS.map((f) => (
          <div key={f.key} className="card p-4 flex items-center justify-between">
            <p className="font-medium text-sm">{f.label}</p>
            {signedUrls[f.key] ? (
              <a
                href={signedUrls[f.key]}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost !py-1.5 !px-3 text-xs"
              >
                <FileText className="w-3.5 h-3.5" /> View
              </a>
            ) : (
              <span className="text-xs text-navy-300">Not uploaded</span>
            )}
          </div>
        ))}
      </div>

      {driver.verification_status !== "verified" && (
        <div className="card p-5 space-y-3">
          <p className="label">Decision</p>
          <textarea
            className="input"
            placeholder="Rejection reason (shown to the driver, only needed if rejecting)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-danger" disabled={busy} onClick={() => decide("rejected")}>
              <XCircle className="w-4 h-4" /> Reject
            </button>
            <button className="btn-primary" disabled={busy} onClick={() => decide("verified")}>
              <CheckCircle2 className="w-4 h-4" /> Verify
            </button>
          </div>
        </div>
      )}

      {driver.verification_status === "verified" && (
        <div className="card p-5 flex items-center gap-2 bg-jade-50 text-jade-700 text-sm">
          <CheckCircle2 className="w-4 h-4" /> This driver is verified and can go online.
        </div>
      )}

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="label flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-gold-500" /> Vuma Deluxe
          </p>
          {driver.deluxe_status && driver.deluxe_status !== "none" && (
            <StatusPill
              status={driver.deluxe_status === "certified" ? "verified" : driver.deluxe_status === "pending" ? "pending" : "rejected"}
            />
          )}
        </div>

        {driver.deluxe_status === "none" && <p className="text-sm text-navy-400">No Deluxe request from this driver.</p>}

        {driver.deluxe_status === "certified" && (
          <p className="text-sm text-jade-700">
            Certified {driver.deluxe_certified_at && format(new Date(driver.deluxe_certified_at), "d MMM yyyy")}
            {driver.deluxe_next_inspection_due && ` — next inspection due ${format(new Date(driver.deluxe_next_inspection_due), "d MMM yyyy")}`}
          </p>
        )}

        {driver.deluxe_notes && <p className="text-xs text-navy-400 italic">Previous notes: {driver.deluxe_notes}</p>}

        {(driver.deluxe_status === "pending" || driver.deluxe_status === "certified" || driver.deluxe_status === "expired") && (
          <>
            <p className="text-xs text-navy-400">
              Certification requires a physical inspection of the vehicle. Record the outcome below.
            </p>
            <div>
              <label className="label block mb-1">Next inspection due (if certifying)</label>
              <input
                type="date"
                className="input"
                value={deluxeNextInspection}
                onChange={(e) => setDeluxeNextInspection(e.target.value)}
              />
            </div>
            <textarea
              className="input"
              placeholder="Inspection notes (e.g. vehicle condition, what was checked)"
              rows={2}
              value={deluxeNotes}
              onChange={(e) => setDeluxeNotes(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <button className="btn-danger" disabled={deluxeBusy} onClick={() => decideDeluxe("reject")}>
                <XCircle className="w-4 h-4" /> Reject
              </button>
              <button className="btn-primary" disabled={deluxeBusy} onClick={() => decideDeluxe("certify")}>
                <CheckCircle2 className="w-4 h-4" /> Certify
              </button>
            </div>
            {driver.deluxe_status === "certified" && (
              <button className="btn-ghost w-full !text-xs" disabled={deluxeBusy} onClick={() => decideDeluxe("expire")}>
                Mark certification as expired (needs re-inspection)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
