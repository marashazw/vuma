"use client";

import { DesktopTabs } from "@/components/ui/DesktopTabs";
import { Home, Clock, Wallet, Gift } from "lucide-react";

export function RiderDesktopTabs() {
  return (
    <DesktopTabs
      items={[
        { href: "/rider", label: "Ride", icon: Home },
        { href: "/rider/history", label: "History", icon: Clock },
        { href: "/rider/wallet", label: "Wallet", icon: Wallet },
        { href: "/rider/referrals", label: "Invite", icon: Gift, highlight: true },
      ]}
    />
  );
}
