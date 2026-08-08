"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SECONDARY_TABS } from "./admin-tabs";

export function AdminSecondaryNav() {
  const pathname = usePathname();
  return (
    <nav>
      <p className="text-[11px] font-semibold text-navy-400 uppercase tracking-wide px-3 mb-2 hidden lg:block">More</p>
      <div className="flex flex-wrap gap-1 lg:flex-col lg:gap-0.5">
        {SECONDARY_TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap",
                active ? "bg-navy-800 text-paper" : "bg-navy-50 text-navy-500 hover:bg-navy-100 hover:text-navy-700 lg:bg-transparent"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
