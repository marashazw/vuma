"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import { currencyFormat } from "@/lib/commission";
import { COUNTRIES } from "@/lib/constants";
import type { DriverWalletTopup, DriverWalletTransaction, CountryCode } from "@/lib/types";
import { Loader2, Wallet, Upload, Paperclip, X, ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";
import { format } from "date-fns";

export default function DriverWalletPage() {
  const supabase = createClient();
  const modal = useModal();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [country, setCountry] = useState<CountryCode>("ZA");
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<DriverWalletTransaction[]>([]);
  const [pendingTopups, setPendingTopups] = useState<DriverWalletTopup[]>([]);

  const [amount, setAmount] = useState<number | "">("");
  const [referenceCode, setReferenceCode] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase.from("profiles").select("country").eq("id", user.id).single();
    setCountry((profile?.country as CountryCode) || "ZA");

    const { data: driverProfile } = await supabase
      .from("driver_profiles")
      .select("prepaid_wallet_balance")
      .eq("user_id", user.id)
      .single();
    setBalance(Number(driverProfile?.prepaid_wallet_balance) || 0);

    const { data: txData } = await supabase
      .from("driver_wallet_transactions")
      .select("*")
      .eq("driver_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setTransactions((txData as DriverWalletTransaction[]) || []);

    const { data: topupData } = await supabase
      .from("driver_wallet_topups")
      .select("*")
      .eq("driver_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setPendingTopups((topupData as DriverWalletTopup[]) || []);

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

    const { error } = await supabase.from("driver_wallet_topups").insert({
      driver_id: userId,
      amount: Number(amount),
      currency: COUNTRIES[country].currency,
      reference_code: referenceCode.trim() || null,
      proof_of_payment_path: proofPath,
      status: "pending",
    });

    setSubmitting(false);
    if (error) {
      await modal.alert(`Could not submit top-up: ${error.message}`);
      return;
    }
    setAmount("");
    setReferenceCode("");
    setProofFile(null);
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  const cfg = COUNTRIES[country];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Wallet</h1>

      <div className="card p-6 bg-navy-800">
        <p className="text-xs text-navy-300 flex items-center gap-1.5 mb-1">
          <Wallet className="w-3.5 h-3.5" /> Prepaid balance
        </p>
        <p className="fare-figure text-4xl font-bold text-white">{currencyFormat(balance, cfg.currency)}</p>
        <p className="text-xs text-navy-300 mt-2">
          Commission is deducted from this balance automatically when you start a trip. Keep it topped up to stay
          online — unless you're on an active subscription plan.
        </p>
      </div>

      {pendingTopups.map((t) => (
        <div key={t.id} className="card p-4 flex items-center gap-3 bg-gold-50 border-gold-200">
          <Clock className="w-4 h-4 text-gold-600 shrink-0" />
          <p className="text-sm text-gold-700">
            Top-up of {currencyFormat(t.amount, t.currency)} is awaiting admin review.
          </p>
        </div>
      ))}

      <div className="card p-5 space-y-3">
        <p className="label">Top up your wallet</p>
        <div>
          <label className="label block mb-1">Amount ({cfg.currencySymbol})</label>
          <input
            type="number"
            min={1}
            className="input"
            placeholder="e.g. 20"
            value={amount}
            onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </div>
        <input
          className="input"
          placeholder="Payment reference/confirmation code (optional if uploading proof)"
          value={referenceCode}
          onChange={(e) => setReferenceCode(e.target.value)}
        />
        {!proofFile ? (
          <label className="btn-primary w-full cursor-pointer">
            <Upload className="w-4 h-4" /> Upload proof of payment (screenshot or PDF)
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
            />
          </label>
        ) : (
          <div className="flex items-center justify-between text-sm bg-navy-50 rounded-lg px-3 py-2">
            <span className="flex items-center gap-1.5 text-navy-600 truncate">
              <Paperclip className="w-3.5 h-3.5 shrink-0" /> {proofFile.name}
            </span>
            <button onClick={() => setProofFile(null)}>
              <X className="w-3.5 h-3.5 text-navy-400" />
            </button>
          </div>
        )}
        <button
          className="btn-primary w-full"
          disabled={submitting || !amount || Number(amount) <= 0}
          onClick={submitTopup}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {uploading ? "Uploading proof…" : submitting ? "Submitting…" : "Submit top-up"}
        </button>
        <p className="text-xs text-navy-400">Your balance updates once an admin confirms this payment.</p>
      </div>

      <div>
        <p className="label mb-3">Recent activity</p>
        {!transactions.length && <p className="text-navy-400 text-sm">No wallet activity yet.</p>}
        <ul className="space-y-2">
          {transactions.map((t) => (
            <li key={t.id} className="card p-3 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5">
                {t.amount >= 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-jade-600 shrink-0" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-coral-500 shrink-0" />
                )}
                <div>
                  <p className="font-medium text-navy-700">
                    {t.type === "topup"
                      ? "Wallet top-up"
                      : t.type === "commission_deduction"
                      ? "Commission"
                      : t.type === "no_show_penalty"
                      ? "No-show / late cancellation penalty"
                      : "Admin adjustment"}
                  </p>
                  <p className="text-xs text-navy-400">{format(new Date(t.created_at), "d MMM yyyy, HH:mm")}</p>
                </div>
              </div>
              <span className={`fare-figure font-semibold ${t.amount >= 0 ? "text-jade-600" : "text-coral-600"}`}>
                {t.amount >= 0 ? "+" : ""}
                {currencyFormat(t.amount, cfg.currency)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
