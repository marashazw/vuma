import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  sub,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  accent?: "gold" | "jade" | "coral";
  sub?: string;
}) {
  const accentClass =
    accent === "gold" ? "text-gold-500" : accent === "jade" ? "text-jade-500" : accent === "coral" ? "text-coral-500" : "text-navy-500";

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <p className="label">{label}</p>
        {Icon && <Icon className={cn("w-4 h-4", accentClass)} />}
      </div>
      <p className="fare-figure text-2xl font-semibold text-navy-800 mt-2">{value}</p>
      {sub && <p className="text-xs text-navy-400 mt-1">{sub}</p>}
    </div>
  );
}
