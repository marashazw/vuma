"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import { currencyFormat } from "@/lib/commission";
import type { WalletTransaction, RiderWalletTopup, VumaAssociateMembership } from "@/lib/types";
import { Loader2, Wallet, ArrowUpRight, ArrowDownLeft, Upload, Paperclip, X, Clock, CheckCircle2, Users } from "lucide-react";
import { format } from "date-fns";

const TYPE_LABELS: Record<string, string> = {
  change_credit: "Change credited by driver",
  reserved: "Applied to a ride",
  redeemed: "Applied to a ride",
  refunded: "Refunded (ride cancelled)",
  admin_adjustment: "Adjustment by admin",
  topup: "Wallet top-up (Vuma Associates)",
};

export default function WalletPage() {
  const supabase = createClient();
  const modal = useModal();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState("ZAR");
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [membership, setMembership] = useState<VumaAssociateMembership | null>(null);
  const [pendingTopups, setPendingTopups] = useState<RiderWalletTopup[]>([]);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState<number | "">("");
  const [referenceCode, setReferenceCode] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [justApproved, setJustApproved] = useState<{ amount: number; currency: string } | null>(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      router.push("/login");
      return;
    }
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_balance, wallet_currency, country")
      .eq("id", user.id)
      .single();
    setBalance(Number(profile?.wallet_balance) || 0);
    setCurrency(profile?.wallet_currency || (profile?.country === "ZW" ? "USD" : "ZAR"));

    const { data: txns } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("rider_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setTransactions((txns as WalletTransaction[]) || []);

    const { data: mem } = await supabase
      .from("vuma_associates_memberships")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle();
    setMembership(mem as VumaAssociateMembership | null);

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

  // Live notification the moment an admin approves a top-up — same
  // pattern already proven on the driver wallet page.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("own-rider-wallet-topups")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rider_wallet_topups", filter: `rider_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as RiderWalletTopup;
          if (updated.status === "approved") {
            setJustApproved({ amount: Number(updated.amount), currency: updated.currency });
          }
          load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
      setUploading(true);
      const path = `${userId}/${Date.now()}-${proofFile.name}`;
      const { error: uploadErr } = await supabase.storage.from("wallet-proofs").upload(path, proofFile);
      setUploading(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  const isActiveMember = membership?.status === "active";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="text-navy-400 text-sm mt-1">
          If a driver doesn't have change, they can credit your wallet instead — apply it to any future ride.
        </p>
      </div>

      {justApproved && (
        <div className="card p-4 bg-jade-50 border-jade-200 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-jade-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-jade-700">
              Top-up approved — {currencyFormat(justApproved.amount, justApproved.currency)} added to your balance
            </p>
            <button onClick={() => setJustApproved(null)} className="text-xs text-jade-600 underline mt-1">
              Dismiss
            </button>
          </div>
          <button onClick={() => setJustApproved(null)} className="text-navy-300 hover:text-navy-500 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="card p-6 bg-navy-800 text-paper text-center">
        <p className="text-navy-300 text-xs uppercase tracking-wide font-semibold flex items-center justify-center gap-1.5 mb-2">
          <Wallet className="w-3.5 h-3.5" /> Balance
        </p>
        <p className="fare-figure text-3xl font-bold text-gold-400">{currencyFormat(balance, currency)}</p>
      </div>

      {!isActiveMember ? (
        <div className="card p-5 bg-gold-50 border-gold-200">
          <p className="text-sm font-semibold text-gold-700 flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Want to top up your wallet directly?
          </p>
          <p className="text-xs text-navy-500 mt-1 mb-3">
            {membership?.status === "pending"
              ? "Your Vuma Associates membership is awaiting confirmation — direct top-ups unlock once you're an active member."
              : "That's a Vuma Associates member benefit — join to add funds to your wallet directly, separate from change credit."}
          </p>
          {!membership && (
            <Link href="/vuma-associates/constitution" className="btn-primary w-full !text-sm text-center block">
              Learn about Vuma Associates
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
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
              />
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
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {uploading ? "Uploading proof…" : submitting ? "Submitting…" : "Submit top-up"}
          </button>
          <p className="text-xs text-navy-400">Your balance updates once an admin confirms this payment.</p>
        </div>
      )}

      {pendingTopups.map((t) => (
        <div key={t.id} className="card p-4 flex items-center gap-3 bg-gold-50 border-gold-200">
          <Clock className="w-4 h-4 text-gold-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gold-700">
              {currencyFormat(t.amount, t.currency)} top-up pending review
            </p>
            <p className="text-xs text-navy-400">Submitted {format(new Date(t.created_at), "d MMM yyyy, HH:mm")}</p>
          </div>
        </div>
      ))}

      <div>
        <p className="label mb-3">History</p>
        {!transactions.length && <p className="text-navy-400 text-sm">No wallet activity yet.</p>}
        <ul className="space-y-2">
          {transactions
            .filter((t) => t.amount !== 0)
            .map((t) => (
              <li key={t.id} className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {t.amount > 0 ? (
                    <ArrowDownLeft className="w-4 h-4 text-jade-500" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-coral-500" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{TYPE_LABELS[t.type] || t.type}</p>
                    <p className="text-xs text-navy-400">{format(new Date(t.created_at), "d MMM yyyy, HH:mm")}</p>
                  </div>
                </div>
                <p className={`fare-figure font-semibold ${t.amount > 0 ? "text-jade-600" : "text-coral-600"}`}>
                  {t.amount > 0 ? "+" : ""}
                  {currencyFormat(t.amount, t.currency)}
                </p>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
