"use client";

import { BottomNav } from "@/components/ui/BottomNav";
import { Home, Clock, Gift, Wallet } from "lucide-react";

export function BottomNavClient() {
  return (
    <BottomNav
      items={[
        { href: "/rider", label: "Ride", icon: Home },
        { href: "/rider/history", label: "History", icon: Clock },
        { href: "/rider/wallet", label: "Wallet", icon: Wallet },
        { href: "/rider/referrals", label: "Invite", icon: Gift, highlight: true },
      ]}
    />
  );
}
