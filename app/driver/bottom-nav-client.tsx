"use client";

import { BottomNav } from "@/components/ui/BottomNav";
import { Car, Wallet, PiggyBank, CreditCard, ShieldCheck, Gift, MessageSquareWarning } from "lucide-react";

export function BottomNavClient({ openRequests = 0 }: { openRequests?: number }) {
  return (
    <BottomNav
      items={[
        { href: "/driver", label: "Requests", icon: Car, badge: openRequests },
        { href: "/driver/forum", label: "Forum", icon: MessageSquareWarning },
        { href: "/driver/earnings", label: "Earnings", icon: Wallet },
        { href: "/driver/wallet", label: "Wallet", icon: PiggyBank },
        { href: "/driver/subscription", label: "Plan", icon: CreditCard },
        { href: "/driver/verification", label: "Verify", icon: ShieldCheck },
        { href: "/driver/referrals", label: "Invite", icon: Gift, highlight: true },
      ]}
    />
  );
}
