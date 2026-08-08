"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/drivers", label: "Drivers" },
  { href: "/admin/riders", label: "Riders" },
  { href: "/admin/commissions", label: "Commissions" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/wallet-topups", label: "Wallet Top-ups" },
  { href: "/admin/appeals", label: "Appeals" },
  { href: "/admin/fraud", label: "Fraud" },
  { href: "/admin/referrals", label: "Referrals" },
  { href: "/admin/safety", label: "Safety" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/admin/transactions", label: "Transactions" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="border-b border-navy-100 bg-white overflow-x-auto">
      <div className="max-w-6xl mx-auto px-5 flex gap-1">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition",
                active ? "border-gold-400 text-navy-800" : "border-transparent text-navy-400 hover:text-navy-600"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
