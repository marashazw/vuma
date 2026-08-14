"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, MessageSquareWarning, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";

export function DriverTopQuickNav({ openRequests = 0 }: { openRequests?: number }) {
  const pathname = usePathname();
  const items = [
    { href: "/driver", label: "Requests", icon: Car, badge: openRequests },
    { href: "/driver/forum", label: "Forum", icon: MessageSquareWarning },
    { href: "/driver/wallet", label: "Wallet", icon: PiggyBank },
  ];

  return (
    <div className="sm:hidden flex items-center justify-center gap-2 px-4 py-2.5 border-b border-navy-100 bg-white">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold",
              active ? "bg-navy-800 text-paper" : "bg-navy-50 text-navy-500"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {item.label}
            {!!item.badge && <span style={{ color: active ? "#F6C89A" : "#D97757" }}>({item.badge})</span>}
          </Link>
        );
      })}
    </div>
  );
}
