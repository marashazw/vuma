"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import { currencyFormat } from "@/lib/commission";
import type { RiderWalletTopup, VumaAssociateMembership, VumaPrivateFeeSettings } from "@/lib/types";
import { Loader2, ArrowLeft, Wallet, Upload, Paperclip, X, Clock, Users, RefreshCw } from "lucide-react";
import { format } from "date-fns";

// A role-agnostic wallet page specifically for Vuma Private — the main
// rider wallet page lives under /rider, whose layout redirects any
// driver-role user straight to /driver before they'd ever see it. Vuma
// Private is deliberately role-agnostic (a driver-role person can be a
// member just as easily as a rider), and the fee always deducts from
// profiles.wallet_balance regardless of role — sending a driver-role
// member to /driver/wallet instead would show them a completely
// different balance (their prepaid commission wallet), not this one.
export default function VumaPrivateWalletPage() {
  const supabase = createClient();
  const modal = useModal();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [membership, setMembership] = useState<VumaAssociateMembership | null>(null);
  const [feeSettings, setFeeSettings] = useState<VumaPrivateFeeSettings | null>(null);
  const [pendingTopups, setPendingTopups] = useState<RiderWalletTopup[]>([]);

  const [amount, setAmount] = useState<number | "">("");
  const [referenceCode, setReferenceCode] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [renewing, setRenewing] = useState(false);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data: profile } = await supabase.from("profiles").select("wallet_balance, wallet_currency, country").eq("id", user.id).single();
    setBalance(Number(profile?.wallet_balance) || 0);
    setCurrency(profile?.wallet_currency || (profile?.country === "ZW" ? "USD" : "ZAR"));

    const { data: mem } = await supabase.from("vuma_associates_memberships").select("*").eq("profile_id", user.id).maybeSingle();
    setMembership(mem as VumaAssociateMembership | null);

    const { data: fee } = await supabase
      .from("vuma_private_fee_settings")
      .select("fee_type, fee_amount, fee_percentage, currency")
      .eq("id", true)
      .single();
    setFeeSettings(fee as VumaPrivateFeeSettings | null);

    const { data: pending } = await supabase
      .from("rider_wallet_topups")
      .select("*")
      .eq("rider_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setPendingTopups((pending as RiderWalletTopup[]) || []);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitTopup() {
    if (!amount || Number(amount) <= 0 || !userId) return;
    if (!referenceCode.trim() && !proofFile) {
      await modal.alert("Add a reference code or upload proof of payment before submitting.");
      return;
    }
    if (!consented) {
      await modal.alert("You need to confirm the statement below before submitting a top-up.");
      return;
    }
    setSubmitting(true);

    let proofPath: string | null = null;
    if (proofFile) {
      const path = `${userId}/${Date.now()}-${proofFile.name}`;
      const { error: uploadErr } = await supabase.storage.from("wallet-proofs").upload(path, proofFile);
      if (uploadErr) {
        setSubmitting(false);
        await modal.alert(`Could not upload proof of payment: ${uploadErr.message}`);
        return;
      }
      proofPath = path;
    }

    const { error } = await supabase.from("rider_wallet_topups").insert({
      rider_id: userId,
      amount: Number(amount),
      currency,
      reference_code: referenceCode.trim() || null,
      proof_of_payment_path: proofPath,
      status: "pending",
      consented_at: new Date().toISOString(),
    });

    setSubmitting(false);
    if (error) {
      await modal.alert(`Could not submit top-up: ${error.message}`);
      return;
    }
    setAmount("");
    setReferenceCode("");
    setProofFile(null);
    setConsented(false);
    await load();
  }

  async function renewMembership() {
    setRenewing(true);
    const res = await fetch("/api/vuma-private/renew-membership", { method: "POST" });
    const data = await res.json();
    setRenewing(false);
    if (!res.ok) {
      await modal.alert(data.error || "Could not renew membership.");
      return;
    }
    await modal.alert(`Renewed — paid up until ${format(new Date(data.paidUpUntil), "d MMM yyyy")}.`);
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  const isActiveMember = membership?.status === "active";
  const paidUp = membership?.paid_up_until && new Date(membership.paid_up_until) > new Date();

  return (
    <div className="min-h-screen bg-paper">
      <header className="px-5 py-4 border-b border-navy-100 flex items-center gap-3">
        <Link href="/vuma-private" className="text-navy-400">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <p className="font-bold text-navy-800">Vuma Private Wallet</p>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">
        <div className="card p-6 bg-navy-800 text-paper text-center">
          <p className="text-navy-300 text-xs uppercase tracking-wide font-semibold flex items-center justify-center gap-1.5 mb-2">
            <Wallet className="w-3.5 h-3.5" /> Balance
          </p>
          <p className="fare-figure text-3xl font-bold text-gold-400">{currencyFormat(balance, currency)}</p>
        </div>

        {feeSettings?.fee_type === "monthly" && isActiveMember && (
          <div className={`card p-5 ${paidUp ? "bg-jade-50 border-jade-200" : "bg-gold-50 border-gold-200"}`}>
            <p className={`text-sm font-semibold flex items-center gap-1.5 ${paidUp ? "text-jade-700" : "text-gold-700"}`}>
              <RefreshCw className="w-4 h-4" /> Monthly membership fee
            </p>
            <p className="text-xs text-navy-500 mt-1 mb-3">
              {paidUp
                ? `Paid up until ${format(new Date(membership!.paid_up_until!), "d MMM yyyy")}.`
                : "Not currently paid up — renew to lock a trip request."}
            </p>
            <button className="btn-primary w-full !text-sm" disabled={renewing} onClick={renewMembership}>
              {renewing ? <Loader2 className="w-4 h-4 animate-spin" /> : `Renew — ${currencyFormat(Number(feeSettings.fee_amount), feeSettings.currency)}`}
            </button>
          </div>
        )}

        {!isActiveMember ? (
          <div className="card p-5 bg-gold-50 border-gold-200">
            <p className="text-sm font-semibold text-gold-700 flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Want to top up your wallet directly?
            </p>
            <p className="text-xs text-navy-500 mt-1 mb-3">
              {membership?.status === "pending"
                ? "Your Vuma Private membership is awaiting confirmation — direct top-ups unlock once you're an active member."
                : "That's a Vuma Private member benefit — join to add funds to your wallet directly."}
            </p>
            {!membership && (
              <Link href="/vuma-associates/constitution" className="btn-primary w-full !text-sm text-center block">
                Learn about Vuma Private
              </Link>
            )}
          </div>
        ) : (
          <div className="card p-5 space-y-3">
            <p className="label">Top up your wallet</p>
            <input
              type="number"
              className="input"
              placeholder={`Amount (${currency})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
            />
            <input
              className="input"
              placeholder="Reference / transaction code (optional if uploading proof)"
              value={referenceCode}
              onChange={(e) => setReferenceCode(e.target.value)}
            />
            {proofFile ? (
              <div className="flex items-center justify-between bg-navy-50 rounded-lg px-3 py-2 text-sm">
                <span className="flex items-center gap-1.5 truncate">
                  <Paperclip className="w-3.5 h-3.5 shrink-0" /> {proofFile.name}
                </span>
                <button onClick={() => setProofFile(null)}>
                  <X className="w-4 h-4 text-navy-400" />
                </button>
              </div>
            ) : (
              <label className="btn-ghost w-full cursor-pointer !text-sm">
                <Upload className="w-4 h-4" /> Upload proof of payment (screenshot or PDF)
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
              </label>
            )}

            <label className="flex items-start gap-2.5 cursor-pointer bg-navy-50 rounded-lg px-3 py-2.5">
              <input
                type="checkbox"
                className="w-4 h-4 mt-0.5 shrink-0 accent-gold-400"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
              />
              <span className="text-xs text-navy-600">
                I agree that this deposit will not be refundable and will only be applied towards ride fares.
              </span>
            </label>

            <button
              className="btn-primary w-full"
              disabled={submitting || !amount || Number(amount) <= 0 || !consented}
              onClick={submitTopup}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit top-up"}
            </button>
            <p className="text-xs text-navy-400">Your balance updates once an admin confirms this payment.</p>
          </div>
        )}

        {pendingTopups.map((t) => (
          <div key={t.id} className="card p-4 flex items-center gap-3 bg-gold-50 border-gold-200">
            <Clock className="w-4 h-4 text-gold-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gold-700">{currencyFormat(t.amount, t.currency)} top-up pending review</p>
              <p className="text-xs text-navy-400">Submitted {format(new Date(t.created_at), "d MMM yyyy, HH:mm")}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
