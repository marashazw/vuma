"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import { currencyFormat } from "@/lib/commission";
import { COUNTRIES } from "@/lib/constants";
import { checkLowBalance, type LowBalanceCheck } from "@/lib/wallet";
import type { DriverWalletTopup, DriverWalletTransaction, CountryCode } from "@/lib/types";
import { Loader2, Wallet, Upload, Paperclip, X, ArrowUpRight, ArrowDownRight, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export default function DriverWalletPage() {
  const supabase = createClient();
  const modal = useModal();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [country, setCountry] = useState<CountryCode>("ZA");
  const [balance, setBalance] = useState(0);
  const [reservedBalance, setReservedBalance] = useState(0);
  const [justApproved, setJustApproved] = useState<{ amount: number; currency: string } | null>(null);
  const [lowBalance, setLowBalance] = useState<LowBalanceCheck | null>(null);
  const [transactions, setTransactions] = useState<DriverWalletTransaction[]>([]);
  const [pendingTopups, setPendingTopups] = useState<DriverWalletTopup[]>([]);

  const [amount, setAmount] = useState<number | "">("");
  const [referenceCode, setReferenceCode] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [consented, setConsented] = useState(false);
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
      .select("prepaid_wallet_balance, reserved_balance")
      .eq("user_id", user.id)
      .single();
    const currentBalance = Number(driverProfile?.prepaid_wallet_balance) || 0;
    const currentReserved = Number(driverProfile?.reserved_balance) || 0;
    setBalance(currentBalance);
    setReservedBalance(currentReserved);
    setLowBalance(await checkLowBalance(supabase, user.id, currentBalance - currentReserved));

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

  // Watches for this driver's own top-up requests being approved —
  // previously there was no way to know a top-up had gone through short
  // of manually reloading the page. Deliberately doesn't navigate
  // anywhere automatically: shown as a persistent notice with a link
  // back to Requests, since the driver might still want to submit
  // another top-up while they're already on this page.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("own-wallet-topups")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "driver_wallet_topups", filter: `driver_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as DriverWalletTopup;
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
  }, [userId, supabase]);

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

    const { error } = await supabase.from("driver_wallet_topups").insert({
      driver_id: userId,
      amount: Number(amount),
      currency: COUNTRIES[country].currency,
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

  const cfg = COUNTRIES[country];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Wallet</h1>

      {justApproved && (
        <div className="card p-4 bg-jade-50 border-jade-200 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-jade-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-jade-700">
              Top-up approved — {currencyFormat(justApproved.amount, justApproved.currency)} added to your balance
            </p>
            <p className="text-xs text-navy-500 mt-1">
              You're all set to go online. Still on this page? Feel free to submit another top-up below if you'd
              like.
            </p>
            <Link href="/driver" className="text-xs font-semibold text-jade-600 underline mt-1.5 inline-block">
              Go to Requests
            </Link>
          </div>
          <button onClick={() => setJustApproved(null)} className="text-navy-300 hover:text-navy-500 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="card p-6 bg-navy-800">
        <p className="text-xs text-navy-300 flex items-center gap-1.5 mb-1">
          <Wallet className="w-3.5 h-3.5" /> Prepaid balance
        </p>
        <p className="fare-figure text-4xl font-bold text-white">{currencyFormat(balance, cfg.currency)}</p>
        {reservedBalance > 0 && (
          <p className="text-xs text-gold-400 mt-2">
            {currencyFormat(reservedBalance, cfg.currency)} held for upcoming scheduled trips — available now:{" "}
            <span className="font-semibold">{currencyFormat(balance - reservedBalance, cfg.currency)}</span>
          </p>
        )}
        <p className="text-xs text-navy-300 mt-2">
          Commission is deducted from this balance automatically when you start a trip. Keep it topped up to stay
          online — unless you're on an active subscription plan.
        </p>
      </div>

      {lowBalance?.isLow && (
        <div className="card p-4 flex items-start gap-2.5 bg-gold-50 border-gold-200">
          <AlertTriangle className="w-4 h-4 text-gold-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gold-700">
              {balance - reservedBalance <= 0 ? "You have no credit — top up to take new trips" : "Your balance is getting low"}
            </p>
            <p className="text-xs text-navy-500 mt-0.5">
              {balance - reservedBalance <= 0
                ? "You won't be able to go online or bid on new trips until you top up."
                : "Based on your usual top-up size and how much you typically spend per day, it's worth topping up soon to avoid running out mid-shift."}
            </p>
          </div>
        </div>
      )}

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

        <label className="flex items-start gap-2.5 cursor-pointer bg-navy-50 rounded-lg px-3 py-2.5">
          <input
            type="checkbox"
            className="w-4 h-4 mt-0.5 shrink-0 accent-gold-400"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
          />
          <span className="text-xs text-navy-600">
            I agree that this deposit will not be refundable and will only be applied towards ride commissions
            and subscriptions.
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
