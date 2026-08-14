"use client";

import { BottomNav } from "@/components/ui/BottomNav";
import { Wallet, CreditCard, ShieldCheck, Gift } from "lucide-react";

export function BottomNavClient() {
  return (
    <BottomNav
      items={[
        { href: "/driver/earnings", label: "Earnings", icon: Wallet },
        { href: "/driver/subscription", label: "Plan", icon: CreditCard },
        { href: "/driver/verification", label: "Verify", icon: ShieldCheck },
        { href: "/driver/referrals", label: "Invite", icon: Gift, highlight: true },
      ]}
    />
  );
}
