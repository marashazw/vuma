"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavNudgeRing } from "./NavNudgeRing";
import type { LucideIcon } from "lucide-react";

export function DesktopTabs({
  items,
}: {
  items: { href: string; label: string; icon: LucideIcon; highlight?: boolean }[];
}) {
  const pathname = usePathname();
  return (
    <div className="hidden sm:block border-b border-navy-100 bg-white overflow-x-auto">
      <div className="max-w-3xl mx-auto px-5 flex gap-1">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          const iconEl = <Icon className="w-4 h-4" />;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition flex items-center gap-1.5",
                active ? "border-gold-400 text-navy-800" : "border-transparent text-navy-400 hover:text-navy-600"
              )}
            >
              {item.highlight && !active ? <NavNudgeRing size={22}>{iconEl}</NavNudgeRing> : iconEl}
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
