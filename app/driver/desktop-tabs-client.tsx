"use client";

import { DesktopTabs } from "@/components/ui/DesktopTabs";
import { useOpenRequestsCount } from "@/lib/hooks/useOpenRequestsCount";
import { Car, Wallet, PiggyBank, CreditCard, ShieldCheck, Gift, MessageSquareWarning } from "lucide-react";

export function DriverDesktopTabs() {
  const openRequests = useOpenRequestsCount();
  return (
    <DesktopTabs
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
