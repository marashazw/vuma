"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { currencyFormat } from "@/lib/commission";
import type {
  SubscriptionPlan,
  DriverSubscription,
  CountryCode,
  PaymentInstructions,
  ManualPaymentSubmission,
} from "@/lib/types";
import { Loader2, CheckCircle2, Smartphone, CreditCard, Landmark, Clock, XCircle, Gift, Upload, ExternalLink, Paperclip, X, Wallet } from "lucide-react";
import { useModal } from "@/components/ui/ModalProvider";
import { format } from "date-fns";

export default function DriverSubscriptionPage() {
  return (
    <Suspense fallback={null}>
      <DriverSubscriptionInner />
    </Suspense>
  );
}

function DriverSubscriptionInner() {
  const modal = useModal();
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [country, setCountry] = useState<CountryCode>("ZA");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [activeSub, setActiveSub] = useState<(DriverSubscription & { plan?: SubscriptionPlan }) | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<PaymentInstructions | null>(null);
  const [pendingManual, setPendingManual] = useState<(ManualPaymentSubmission & { plan?: SubscriptionPlan })[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [ecocashPhone, setEcocashPhone] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState<Record<string, string>>({});
  const [proofFile, setProofFile] = useState<Record<string, File | null>>({});
  const [uploadingProof, setUploadingProof] = useState<string | null>(null);
  const [submittingManual, setSubmittingManual] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState(0);
  const [spendingCredit, setSpendingCredit] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [spendingWallet, setSpendingWallet] = useState<string | null>(null);
  const [showAltPayment, setShowAltPayment] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("success")) setNotice("Subscription activated!");
    if (searchParams.get("cancelled")) setNotice("Payment cancelled.");
  }, [searchParams]);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("country").eq("id", user.id).single();
    const c = (profile?.country as CountryCode) || "ZA";
    setCountry(c);

    const { data: plansData } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("country", c)
      .eq("is_active", true)
      .order("price", { ascending: true });
    setPlans((plansData as SubscriptionPlan[]) || []);

    const { data: sub } = await supabase
      .from("driver_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("driver_id", user.id)
      .eq("status", "active")
      .gte("ends_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveSub(sub as any);

    const { data: instructions } = await supabase.from("payment_instructions").select("*").eq("country", c).single();
    setPaymentInstructions(instructions as PaymentInstructions);

    const { data: manualSubs } = await supabase
      .from("manual_payment_submissions")
      .select("*, plan:subscription_plans(*)")
      .eq("driver_id", user.id)
      .order("created_at", { ascending: false });
    setPendingManual((manualSubs as any) || []);

    const { data: driverProfile } = await supabase
      .from("driver_profiles")
      .select("credit_balance, prepaid_wallet_balance")
      .eq("user_id", user.id)
      .single();
    setCreditBalance(Number(driverProfile?.credit_balance) || 0);
    setWalletBalance(Number(driverProfile?.prepaid_wallet_balance) || 0);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function purchase(plan: SubscriptionPlan, gateway: "payfast" | "paynow") {
    setPurchasingId(plan.id);
    const res = await fetch("/api/subscriptions/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, gateway, ecocashPhone: ecocashPhone || undefined }),
    });
    const data = await res.json();
    setPurchasingId(null);

    if (data.mock) {
      router.push(data.redirectUrl);
      router.refresh();
      return;
    }
    if (data.fields && data.actionUrl) {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.actionUrl;
      Object.entries(data.fields as Record<string, string>).forEach(([k, v]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = k;
        input.value = v;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
      return;
    }
    if (data.redirectUrl) {
      window.location.href = data.redirectUrl;
    }
  }

  async function spendCreditOnPlan(plan: SubscriptionPlan) {
    setSpendingCredit(plan.id);
    const res = await fetch("/api/driver/credit/spend-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id }),
    });
    const data = await res.json();
    setSpendingCredit(null);
    if (!res.ok) {
      await modal.alert(data.error);
      return;
    }
    setNotice("Subscription activated using your credit balance!");
    await load();
  }

  async function spendWalletOnPlan(plan: SubscriptionPlan) {
    setSpendingWallet(plan.id);
    const res = await fetch("/api/driver/wallet/spend-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id }),
    });
    const data = await res.json();
    setSpendingWallet(null);
    if (!res.ok) {
      await modal.alert(data.error);
      return;
    }
    setNotice("Subscription activated using your wallet balance!");
    await load();
  }

  async function submitManualPayment(plan: SubscriptionPlan) {
    const ref = referenceCode[plan.id]?.trim();
    const file = proofFile[plan.id];
    if (!ref && !file) return;

    setSubmittingManual(plan.id);

    let proofPath: string | null = null;
    if (file) {
      setUploadingProof(plan.id);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const path = `${user.id}/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("payment-proofs").upload(path, file);
        if (uploadErr) {
          await modal.alert(`Could not upload proof of payment: ${uploadErr.message}`);
          setUploadingProof(null);
          setSubmittingManual(null);
          return;
        }
        proofPath = path;
      }
      setUploadingProof(null);
    }

    const res = await fetch("/api/driver/subscriptions/manual-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: plan.id,
        referenceCode: ref || undefined,
        proofOfPaymentPath: proofPath || undefined,
        amountClaimed: plan.price,
      }),
    });
    const data = await res.json();
    setSubmittingManual(null);
    if (!res.ok) {
      await modal.alert(`Could not submit: ${data.error}`);
      return;
    }
    setReferenceCode((prev) => ({ ...prev, [plan.id]: "" }));
    setProofFile((prev) => ({ ...prev, [plan.id]: null }));
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading plans&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Subscription</h1>
      {notice && <div className="card p-4 bg-jade-50 text-jade-700 text-sm">{notice}</div>}

      {activeSub ? (
        <div className="card p-5">
          <div className="flex items-center gap-2 text-jade-600 mb-1">
            <CheckCircle2 className="w-5 h-5" />
            <p className="font-semibold">{activeSub.plan?.name}</p>
          </div>
          <p className="text-sm text-navy-400">
            Active until {format(new Date(activeSub.ends_at), "d MMM yyyy")} &middot; commission while active:{" "}
            {activeSub.plan?.commission_pct_while_active}%
          </p>
        </div>
      ) : (
        <p className="text-navy-400 text-sm">
          No active subscription — you&rsquo;re on standard per-ride commission. Subscribe below for a flat periodic rate instead.
        </p>
      )}

      {pendingManual.filter((m) => m.status === "pending").map((m) => (
        <div key={m.id} className="card p-4 flex items-center gap-3 bg-gold-50 border-gold-200">
          <Clock className="w-4 h-4 text-gold-600 shrink-0" />
          <p className="text-sm text-gold-700">
            Your payment for <strong>{m.plan?.name}</strong>
            {m.reference_code ? ` (ref: ${m.reference_code})` : " (proof uploaded)"} is awaiting admin review.
          </p>
        </div>
      ))}
      {pendingManual
        .filter((m) => m.status === "rejected")
        .slice(0, 1)
        .map((m) => (
          <div key={m.id} className="card p-4 flex items-start gap-3 bg-coral-500/5 border-coral-500/20">
            <XCircle className="w-4 h-4 text-coral-600 shrink-0 mt-0.5" />
            <p className="text-sm text-coral-700">
              Your last manual payment was rejected
              {m.rejection_reason ? `: ${m.rejection_reason}` : "."}
            </p>
          </div>
        ))}

      <div className="space-y-3">
        {plans.map((plan) => (
          <div key={plan.id} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold">{plan.name}</p>
                <p className="text-xs text-navy-400 capitalize">{plan.period.replace("_", " ")}</p>
              </div>
              <p className="fare-figure text-lg font-bold">{currencyFormat(plan.price, plan.currency)}</p>
            </div>
            <p className="text-xs text-navy-400 mb-4">
              {plan.commission_pct_while_active === 0
                ? "0% commission while active"
                : `${plan.commission_pct_while_active}% commission while active`}
            </p>

            <div className="space-y-4">
              <p className="text-sm font-semibold text-navy-700">
                {paymentInstructions?.gateway_enabled
                  ? "There are 4 ways you can pay:"
                  : "There are 3 ways you can pay right now — card payments are coming soon:"}
              </p>

              {/* 1. Credit balance ("by subscription" — your earned credit, redeemed toward this) */}
              <div>
                <p className="label mb-2 !text-[#D97757]">1. By subscription credit</p>
                {creditBalance >= plan.price ? (
                  <button className="btn-primary w-full" disabled={!!spendingCredit} onClick={() => spendCreditOnPlan(plan)}>
                    {spendingCredit === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />} Pay
                    with credit balance ({currencyFormat(creditBalance, plan.currency)} available)
                  </button>
                ) : (
                  <p className="text-xs text-navy-400">
                    {creditBalance > 0
                      ? `You have ${currencyFormat(creditBalance, plan.currency)} credit — not quite enough for this plan yet.`
                      : "Earn credit by crediting riders' change or referring other drivers — redeemable here."}
                  </p>
                )}
              </div>

              {/* 2. Prepaid wallet balance — a driver's own topped-up balance */}
              <div>
                <p className="label mb-2 !text-[#D97757]">2. From your wallet balance</p>
                {walletBalance >= plan.price ? (
                  <button className="btn-primary w-full" disabled={!!spendingWallet} onClick={() => spendWalletOnPlan(plan)}>
                    {spendingWallet === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />} Pay
                    with wallet balance ({currencyFormat(walletBalance, plan.currency)} available)
                  </button>
                ) : (
                  <p className="text-xs text-navy-400">
                    {walletBalance > 0
                      ? `You have ${currencyFormat(walletBalance, plan.currency)} in your wallet — not quite enough for this plan yet.`
                      : "Top up your prepaid wallet, then pay for a subscription straight from it — see the Wallet tab."}
                  </p>
                )}
              </div>

              {/* 3. Manual payment — the default, primary option */}
              <div>
                <p className="label mb-2 !text-[#D97757]">3. Manually, as below</p>
                <div className="border border-navy-100 rounded-xl p-4 space-y-3">
                  <div>
                    <p className="label mb-1">{paymentInstructions?.method_label || "Mobile wallet transfer"}</p>
                    {paymentInstructions?.account_name && (
                      <p className="text-sm">
                        <span className="text-navy-400">To: </span>
                        {paymentInstructions.account_name}
                      </p>
                    )}
                    {paymentInstructions?.account_number && (
                      <p className="text-sm font-mono font-semibold">{paymentInstructions.account_number}</p>
                    )}
                    {paymentInstructions?.instructions && (
                      <p className="text-xs text-navy-400 mt-1">{paymentInstructions.instructions}</p>
                    )}
                    {paymentInstructions?.link_url && (
                      <a
                        href={paymentInstructions.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-gold-600 font-semibold mt-2 underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> {paymentInstructions.link_label || "Open payment link"}
                      </a>
                    )}
                  </div>

                  <input
                    className="input"
                    placeholder="Paste your payment reference/confirmation code (optional if uploading proof)"
                    value={referenceCode[plan.id] || ""}
                    onChange={(e) => setReferenceCode((prev) => ({ ...prev, [plan.id]: e.target.value }))}
                  />

                  <div>
                    {!proofFile[plan.id] ? (
                      <label className="btn-primary w-full cursor-pointer">
                        <Upload className="w-4 h-4" /> Upload proof of payment (screenshot or PDF)
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => setProofFile((prev) => ({ ...prev, [plan.id]: e.target.files?.[0] || null }))}
                        />
                      </label>
                    ) : (
                      <div className="flex items-center justify-between text-sm bg-navy-50 rounded-lg px-3 py-2">
                        <span className="flex items-center gap-1.5 text-navy-600 truncate">
                          <Paperclip className="w-3.5 h-3.5 shrink-0" /> {proofFile[plan.id]?.name}
                        </span>
                        <button onClick={() => setProofFile((prev) => ({ ...prev, [plan.id]: null }))}>
                          <X className="w-3.5 h-3.5 text-navy-400" />
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    className="btn-primary w-full"
                    onClick={() => submitManualPayment(plan)}
                    disabled={submittingManual === plan.id || (!referenceCode[plan.id]?.trim() && !proofFile[plan.id])}
                  >
                    {submittingManual === plan.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> {uploadingProof === plan.id ? "Uploading proof…" : "Submitting…"}
                      </>
                    ) : (
                      "Submit for review"
                    )}
                  </button>
                  <p className="text-xs text-navy-400">
                    Your subscription activates once an admin confirms this payment — usually within a few hours.
                  </p>
                </div>
              </div>

              {/* 3. Card/mobile-money gateways — alternative option, hidden until gateway integration is ready */}
              {paymentInstructions?.gateway_enabled && (
                <div>
                  <p className="label mb-2 !text-[#D97757]">4. Prefer to pay by card</p>
                  {showAltPayment !== plan.id ? (
                    <button className="btn-primary w-full" onClick={() => setShowAltPayment(plan.id)}>
                      <CreditCard className="w-4 h-4" /> Pay by card or {country === "ZA" ? "PayFast" : "EcoCash/Paynow"} instead
                    </button>
                  ) : (
                    <div className="space-y-2 pt-1">
                      {country === "ZA" ? (
                        <button className="btn-primary w-full" disabled={!!purchasingId} onClick={() => purchase(plan, "payfast")}>
                          {purchasingId === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}{" "}
                          Pay with PayFast
                        </button>
                      ) : (
                        <>
                          <input
                            className="input"
                            placeholder="EcoCash number (e.g. 077 xxx xxxx)"
                            value={ecocashPhone}
                            onChange={(e) => setEcocashPhone(e.target.value)}
                          />
                          <button className="btn-primary w-full" disabled={!!purchasingId} onClick={() => purchase(plan, "paynow")}>
                            {purchasingId === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}{" "}
                            Pay with EcoCash / Paynow
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
