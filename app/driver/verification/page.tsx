"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DocumentUploadRow } from "@/components/driver/DocumentUploadRow";
import { StatusPill } from "@/components/ui/StatusPill";
import type { DriverProfile } from "@/lib/types";
import { Loader2, ShieldCheck, Check, Sparkles } from "lucide-react";
import { useModal } from "@/components/ui/ModalProvider";
import { format } from "date-fns";

const SEAT_OPTIONS = [2, 3, 4, 5, 6, 7, 8];

export default function DriverVerificationPage() {
  const modal = useModal();
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requireMembership, setRequireMembership] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState<string | null>(null);

  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [vehicleSeats, setVehicleSeats] = useState<number | null>(null);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [vehicleSaved, setVehicleSaved] = useState(false);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      // Previously returned here with no further action, leaving
      // `loading` stuck true forever — the page would spin indefinitely
      // with no way to recover short of a hard reload. This can happen
      // on a session timing hiccup, not just a genuine logged-out state.
      setLoading(false);
      router.push("/login");
      return;
    }
    setUserId(user.id);
    const { data } = await supabase.from("driver_profiles").select("*").eq("user_id", user.id).single();
    setProfile(data as DriverProfile);
    setVehicleMake(data?.vehicle_make || "");
    setVehicleModel(data?.vehicle_model || "");
    setVehicleColor(data?.vehicle_color || "");
    setPlateNumber(data?.plate_number || "");
    setVehicleSeats(data?.vehicle_seats ?? null);

    const { data: settings } = await supabase
      .from("vuma_associates_settings")
      .select("require_membership_for_driver_registration")
      .eq("id", true)
      .single();
    setRequireMembership(!!settings?.require_membership_for_driver_registration);

    const { data: membership } = await supabase
      .from("vuma_associates_memberships")
      .select("status")
      .eq("profile_id", user.id)
      .maybeSingle();
    setMembershipStatus(membership?.status || null);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setPath(column: string, path: string) {
    if (!userId) return;
    await supabase.from("driver_profiles").update({ [column]: path }).eq("user_id", userId);
    await load();
  }

  async function saveVehicleDetails() {
    if (!userId) return;
    setSavingVehicle(true);

    const normalizedPlate = plateNumber.trim().toUpperCase() || null;

    // Fraud detection: does this plate already belong to a different
    // driver? Doesn't block the save (legitimate vehicle transfers happen)
    // — it flags the account for admin review and excludes it from
    // referral-reward qualification until cleared.
    let duplicateFlag = false;
    let duplicateMatchId: string | null = null;
    if (normalizedPlate) {
      const { data: matches } = await supabase
        .from("driver_profiles")
        .select("user_id, plate_number")
        .neq("user_id", userId);
      const match = (matches || []).find((m) => (m.plate_number || "").trim().toUpperCase() === normalizedPlate);
      if (match) {
        duplicateFlag = true;
        duplicateMatchId = match.user_id;
      }
    }

    const { error } = await supabase
      .from("driver_profiles")
      .update({
        vehicle_make: vehicleMake || null,
        vehicle_model: vehicleModel || null,
        vehicle_color: vehicleColor || null,
        plate_number: normalizedPlate,
        vehicle_seats: vehicleSeats,
        duplicate_vehicle_flag: duplicateFlag,
        duplicate_vehicle_matches_user_id: duplicateMatchId,
      })
      .eq("user_id", userId);
    setSavingVehicle(false);
    if (error) {
      await modal.alert(`Could not save vehicle details: ${error.message}`);
      return;
    }
    if (duplicateFlag) {
      await modal.alert(
        "Note: this plate number matches another driver's vehicle on file. Your account has been flagged for admin review — this won't stop you from driving, but any referral rewards will be held until it's cleared."
      );
    }
    setVehicleSaved(true);
    setTimeout(() => setVehicleSaved(false), 2000);
    await load();
  }

  async function requestDeluxe() {
    if (!userId) return;
    const { error } = await supabase
      .from("driver_profiles")
      .update({ deluxe_status: "pending", deluxe_requested_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) {
      await modal.alert(`Could not submit request: ${error.message}`);
      return;
    }
    await load();
  }

  async function submitForReview() {
    if (!userId || !declarationAccepted) return;
    setSubmitting(true);
    await supabase
      .from("driver_profiles")
      .update({
        verification_status: "pending",
        submitted_at: new Date().toISOString(),
        declaration_accepted_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    await load();
    setSubmitting(false);
    setSubmitted(true);
  }

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  const vehicleComplete = !!vehicleMake && !!vehicleModel && !!plateNumber && !!vehicleSeats;
  const allUploaded =
    !!profile.id_document_path &&
    !!profile.license_document_path &&
    !!profile.vehicle_registration_path &&
    !!profile.profile_photo_path;
  const membershipSatisfied = !requireMembership || membershipStatus === "active";
  const readyToSubmit = allUploaded && vehicleComplete && declarationAccepted && membershipSatisfied;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Verification</h1>
          <p className="text-navy-400 text-sm mt-1">Upload these once — admins review and verify your account.</p>
        </div>
        <StatusPill status={profile.verification_status} />
      </div>

      {profile.verification_status === "rejected" && profile.rejection_reason && (
        <div className="card p-4 bg-coral-500/5 border-coral-500/20 text-coral-700 text-sm">
          <p className="font-semibold mb-1">Your last submission was rejected</p>
          <p>{profile.rejection_reason}</p>
        </div>
      )}

      {profile.verification_status === "verified" && (
        <div className="card p-5 flex items-center gap-3 bg-jade-50 text-jade-700">
          <ShieldCheck className="w-5 h-5" />
          <p className="text-sm font-medium">You&rsquo;re verified — you can go online and accept rides.</p>
        </div>
      )}

      <div className="card p-5 space-y-4">
        <div>
          <p className="label mb-1">Vehicle details</p>
          <p className="text-xs text-navy-400">
            Riders see this to identify your car, and your seat capacity determines which ride requests you can bid
            on — you can only bid on rides needing your capacity or fewer seats.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label mb-1.5 block">Make</label>
            <input className="input" placeholder="Toyota" value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} />
          </div>
          <div>
            <label className="label mb-1.5 block">Model</label>
            <input className="input" placeholder="Corolla" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} />
          </div>
          <div>
            <label className="label mb-1.5 block">Color</label>
            <input className="input" placeholder="Silver" value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} />
          </div>
          <div>
            <label className="label mb-1.5 block">Plate number</label>
            <input
              className="input"
              placeholder="ABC 123 GP"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
            />
          </div>
        </div>

        <div>
          <label className="label mb-2 block">Seat capacity (including driver)</label>
          <div className="flex flex-wrap gap-2">
            {SEAT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                className={`btn-ghost !px-3 !py-2 text-sm ${vehicleSeats === n ? "!bg-navy-800 !text-paper !border-navy-800" : ""}`}
                onClick={() => setVehicleSeats(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button className="btn-dark w-full" onClick={saveVehicleDetails} disabled={savingVehicle}>
          {savingVehicle ? <Loader2 className="w-4 h-4 animate-spin" /> : vehicleSaved ? <Check className="w-4 h-4" /> : null}
          {vehicleSaved ? "Saved" : "Save vehicle details"}
        </button>
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="label flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-gold-500" /> Vuma Deluxe
          </p>
          {profile.deluxe_status && profile.deluxe_status !== "none" && (
            <StatusPill
              status={
                profile.deluxe_status === "certified" ? "verified" : profile.deluxe_status === "pending" ? "pending" : "rejected"
              }
            />
          )}
        </div>
        <p className="text-xs text-navy-400">
          For executive, top-of-range vehicles. Deluxe cars can bid on both Deluxe and regular requests, see Deluxe
          requests (regular drivers can't), and earn a 1.5× suggested fare — commission is also charged at 1.5×.
          Certification requires a physical inspection by an admin, renewed periodically.
        </p>

        {profile.deluxe_status === "certified" && (
          <div className="text-sm text-jade-700 bg-jade-50 rounded-lg px-3 py-2">
            Certified {profile.deluxe_certified_at ? format(new Date(profile.deluxe_certified_at), "d MMM yyyy") : ""}
            {profile.deluxe_next_inspection_due &&
              ` — next inspection due ${format(new Date(profile.deluxe_next_inspection_due), "d MMM yyyy")}`}
          </div>
        )}
        {profile.deluxe_status === "pending" && (
          <div className="text-sm text-gold-700 bg-gold-50 rounded-lg px-3 py-2">
            Request submitted — an admin will contact you to arrange a physical inspection.
          </div>
        )}
        {profile.deluxe_status === "expired" && (
          <div className="text-sm text-coral-700 bg-coral-500/5 rounded-lg px-3 py-2">
            Your Deluxe certification has expired — request re-certification below.
          </div>
        )}
        {profile.deluxe_notes && <p className="text-xs text-navy-400 italic">Admin notes: {profile.deluxe_notes}</p>}

        {(profile.deluxe_status === "none" || profile.deluxe_status === "expired") && (
          <button className="btn-dark w-full" onClick={requestDeluxe}>
            Request Vuma Deluxe certification
          </button>
        )}
      </div>

      <div className="space-y-3">
        <DocumentUploadRow
          userId={userId!}
          storageKey="id-document"
          label="Government-issued ID"
          hint="National ID or passport, clear photo of both sides if applicable."
          existingPath={profile.id_document_path}
          onUploaded={(path) => setPath("id_document_path", path)}
        />
        <DocumentUploadRow
          userId={userId!}
          storageKey="license"
          label="Driver's license"
          hint="Valid driver's license, front and back."
          existingPath={profile.license_document_path}
          onUploaded={(path) => setPath("license_document_path", path)}
        />
        <DocumentUploadRow
          userId={userId!}
          storageKey="vehicle-registration"
          label="Vehicle registration"
          hint="Proof of registration / logbook for the vehicle you'll drive."
          existingPath={profile.vehicle_registration_path}
          onUploaded={(path) => setPath("vehicle_registration_path", path)}
        />
        <DocumentUploadRow
          userId={userId!}
          storageKey="profile-photo"
          label="Profile photo"
          hint="A clear, recent photo of your face — shown to riders."
          existingPath={profile.profile_photo_path}
          onUploaded={(path) => setPath("profile_photo_path", path)}
        />
        <DocumentUploadRow
          userId={userId!}
          storageKey="other-document"
          label="Other (optional)"
          hint="Anything else worth including that doesn't fit the categories above."
          existingPath={profile.other_document_path}
          onUploaded={(path) => setPath("other_document_path", path)}
        />
      </div>

      {profile.verification_status !== "verified" && requireMembership && !membershipSatisfied && (
        <div className="card p-4 bg-gold-50 border-gold-200">
          <p className="text-sm font-semibold text-gold-700">Vuma Private membership required</p>
          <p className="text-xs text-navy-500 mt-1 mb-3">
            Driver registration currently requires an active Vuma Private membership.{" "}
            {membershipStatus === "pending"
              ? "Yours is awaiting confirmation — you'll be able to submit once it's active."
              : "Join to continue with your driver verification."}
          </p>
          {!membershipStatus && (
            <a href="/vuma-associates/constitution" className="btn-primary w-full !text-sm text-center block">
              Learn about Vuma Private
            </a>
          )}
        </div>
      )}

      {profile.verification_status !== "verified" && (
        <div className="card p-4 bg-navy-50">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 mt-0.5 shrink-0 accent-gold-400"
              checked={declarationAccepted}
              onChange={(e) => setDeclarationAccepted(e.target.checked)}
            />
            <span className="text-xs text-navy-600 leading-relaxed">
              I understand that I am authorised by relevant legislation and authorities to participate in this
              business, my vehicle is appropriately insured and certified, and I promise to be in full compliance
              with local laws at all times. I acknowledge that Vuma will not be held accountable for my actions and
              omissions.
            </span>
          </label>
        </div>
      )}

      {profile.verification_status !== "verified" && (
        <button className="btn-primary w-full" disabled={!readyToSubmit || submitting} onClick={submitForReview}>
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitted ? "Submitted — awaiting review" : "Submit for review"}
        </button>
      )}
      {!readyToSubmit && profile.verification_status !== "verified" && (
        <p className="text-xs text-navy-400 text-center">
          {!allUploaded || !vehicleComplete
            ? "Complete your vehicle details and upload all four documents to submit for review."
            : !membershipSatisfied
            ? "An active Vuma Private membership is required before you can submit."
            : "Accept the declaration above to submit for review."}
        </p>
      )}
    </div>
  );
}
