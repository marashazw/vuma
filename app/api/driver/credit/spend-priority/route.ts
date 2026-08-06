import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { COUNTRIES } from "@/lib/constants";
import type { CountryCode } from "@/lib/types";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { days } = await req.json();
  const daysToBuy = Number(days);
  if (!daysToBuy || daysToBuy <= 0) {
    return NextResponse.json({ error: "A positive number of days is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("country").eq("id", user.id).single();
  const country = (profile?.country as CountryCode) || "ZA";
  const rate = COUNTRIES[country].priorityBoostPerDay;
  const cost = rate * daysToBuy;

  const { data: driverProfile } = await admin
    .from("driver_profiles")
    .select("credit_balance, priority_until")
    .eq("user_id", user.id)
    .single();
  const balance = Number(driverProfile?.credit_balance || 0);

  if (balance < cost) {
    return NextResponse.json(
      {
        error: `${daysToBuy} day(s) of priority costs ${COUNTRIES[country].currencySymbol}${cost}, you have ${COUNTRIES[country].currencySymbol}${balance.toFixed(2)} credit.`,
      },
      { status: 400 }
    );
  }

  const currentPriority = driverProfile?.priority_until ? new Date(driverProfile.priority_until) : new Date();
  const base = currentPriority > new Date() ? currentPriority : new Date();
  const newPriority = new Date(base.getTime() + daysToBuy * 86400000).toISOString();

  await admin
    .from("driver_profiles")
    .update({ credit_balance: balance - cost, priority_until: newPriority })
    .eq("user_id", user.id);

  await admin.from("driver_credit_transactions").insert({
    driver_id: user.id,
    type: "spent_priority",
    amount: -cost,
    currency: COUNTRIES[country].currency,
    notes: `Bought ${daysToBuy} day(s) of priority ranking`,
  });

  return NextResponse.json({ ok: true, priorityUntil: newPriority });
}
