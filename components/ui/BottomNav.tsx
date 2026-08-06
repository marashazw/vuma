"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavNudgeRing } from "./NavNudgeRing";
import type { LucideIcon } from "lucide-react";

export function BottomNav({
  items,
}: {
  items: { href: string; label: string; icon: LucideIcon; highlight?: boolean }[];
}) {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-navy-100 flex items-stretch z-30 sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        const iconEl = <Icon className="w-5 h-5" />;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium",
              active ? "text-gold-500" : "text-navy-400"
            )}
          >
            {item.highlight && !active ? <NavNudgeRing size={28}>{iconEl}</NavNudgeRing> : iconEl}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
