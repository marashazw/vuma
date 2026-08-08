"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/constants";
import type { CountryCode, UserRole } from "@/lib/types";
import { Loader2, Phone, Mail } from "lucide-react";

type Method = "phone" | "email";

export function AuthForm({
  mode,
  referralCode,
  driverReferralCode,
}: {
  mode: "login" | "signup";
  referralCode?: string;
  driverReferralCode?: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [method, setMethod] = useState<Method>("phone");
  const [role, setRole] = useState<UserRole>(driverReferralCode ? "driver" : "rider");
  const [country, setCountry] = useState<CountryCode>("ZA");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function afterAuthSuccess(userId: string) {
    if (mode === "signup") {
      const { error: profileErr } = await supabase.from("profiles").insert({
        id: userId,
        role,
        full_name: fullName || "New user",
        phone: method === "phone" || role === "driver" ? phone || null : null,
        email: method === "email" ? email : null,
        country,
        referred_by: referralCode && referralCode !== userId ? referralCode : null,
      });
      if (profileErr && profileErr.code !== "23505") {
        setError(profileErr.message);
        setLoading(false);
        return;
      }
      // Only create a driver_profiles row when the profile insert above
      // genuinely succeeded (a brand-new signup) — never when it failed
      // with a duplicate-key error, meaning this person already has an
      // account. Previously this check ran regardless, so an
      // already-registered person landing back on the signup page —
      // with "Driver" happening to be selected on the form for any
      // reason — would get a stray driver_profiles row created for
      // them, completely independent of their actual account role.
      if (role === "driver" && !profileErr) {
        await supabase.from("driver_profiles").insert({ user_id: userId });
      }
      if (referralCode && referralCode !== userId && !profileErr) {
        // Best-effort — a bad/foreign code just means no referral credit,
        // never blocks signup.
        await supabase.from("referrals").insert({
          referrer_id: referralCode,
          referred_id: userId,
          status: "pending",
        });
      }
      if (driverReferralCode && driverReferralCode !== userId && role === "driver" && !profileErr) {
        // Same best-effort approach — a duplicate/invalid code just means
        // no referral link, never blocks signup. The unique constraint on
        // referred_id also guarantees a driver can never be referred twice.
        await supabase.from("driver_referrals").insert({
          referrer_id: driverReferralCode,
          referred_id: userId,
          status: "pending",
        });
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    router.push(profile?.role === "driver" ? "/driver" : profile?.role === "admin" ? "/admin" : "/rider");
    router.refresh();
  }

  async function handlePhoneRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setOtpSent(true);
  }

  async function handlePhoneVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
    if (error || !data.user) {
      setError(error?.message || "Invalid code");
      setLoading(false);
      return;
    }
    await afterAuthSuccess(data.user.id);
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "signup" && role === "driver" && !phone.trim()) {
      setError("A phone number is required to sign up as a driver.");
      return;
    }

    setLoading(true);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error || !data.user) {
        setError(error?.message || "Could not sign up");
        setLoading(false);
        return;
      }
      await afterAuthSuccess(data.user.id);
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        setError(error?.message || "Invalid credentials");
        setLoading(false);
        return;
      }
      await afterAuthSuccess(data.user.id);
    }
  }

  return (
    <div className="card p-6 sm:p-8 w-full max-w-md">
      {mode === "signup" && (
        <div className="mb-5">
          <p className="label mb-2">I am a</p>
          {driverReferralCode && (
            <p className="text-xs text-gold-700 bg-gold-50 rounded-lg px-3 py-2 mb-2">
              This link is for driver sign-ups, so "Driver" is selected below. Looking to request rides instead?
              Tap "Rider."
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {(["rider", "driver"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`btn ${role === r ? "btn-dark" : "btn-ghost"} capitalize`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "signup" && (
        <div className="mb-5">
          <p className="label mb-2">Country</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(COUNTRIES) as CountryCode[])
              .filter((c) => c !== "OTHER")
              .map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCountry(c)}
                  className={`btn ${country === c ? "btn-dark" : "btn-ghost"}`}
                >
                  {COUNTRIES[c].label}
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-5">
        <button
          type="button"
          onClick={() => setMethod("phone")}
          className={`btn flex-1 ${method === "phone" ? "btn-dark" : "btn-ghost"}`}
        >
          <Phone className="w-4 h-4" /> Phone
        </button>
        <button
          type="button"
          onClick={() => setMethod("email")}
          className={`btn flex-1 ${method === "email" ? "btn-dark" : "btn-ghost"}`}
        >
          <Mail className="w-4 h-4" /> Email
        </button>
      </div>

      {mode === "signup" && (
        <div className="mb-4">
          <label className="label mb-1.5 block">Full name</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Thandiwe Nkosi" />
        </div>
      )}

      {method === "phone" ? (
        !otpSent ? (
          <form onSubmit={handlePhoneRequest} className="space-y-4">
            <div>
              <label className="label mb-1.5 block">Phone number</label>
              <input
                className="input"
                type="tel"
                required
                placeholder="+27 82 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-coral-600">{error}</p>}
            <button className="btn-primary w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Send code
            </button>
            <p className="text-xs text-navy-400">
              Requires an SMS provider configured in Supabase Auth (see README) — until then, use email instead.
            </p>
          </form>
        ) : (
          <form onSubmit={handlePhoneVerify} className="space-y-4">
            <div>
              <label className="label mb-1.5 block">Enter the 6-digit code</label>
              <input className="input tracking-widest text-center text-lg" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} />
            </div>
            {error && <p className="text-sm text-coral-600">{error}</p>}
            <button className="btn-primary w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Verify & continue
            </button>
          </form>
        )
      ) : (
        <form onSubmit={handleEmail} className="space-y-4">
          <div>
            <label className="label mb-1.5 block">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode === "signup" && role === "driver" && (
            <div>
              <label className="label mb-1.5 block">Phone number</label>
              <input
                className="input"
                type="tel"
                required
                placeholder="+27 82 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="text-xs text-navy-400 mt-1">
                Required for drivers — riders need a way to reach you about a trip.
              </p>
            </div>
          )}
          <div>
            <label className="label mb-1.5 block">Password</label>
            <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-coral-600">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} {mode === "signup" ? "Create account" : "Log in"}
          </button>
        </form>
      )}
    </div>
  );
}
