import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  requested: "bg-navy-50 text-navy-500",
  negotiating: "bg-gold-50 text-gold-600",
  accepted: "bg-jade-50 text-jade-600",
  in_progress: "bg-jade-100 text-jade-600",
  completed: "bg-navy-50 text-navy-500",
  cancelled: "bg-coral-500/10 text-coral-600",
  active: "bg-jade-50 text-jade-600",
  expired: "bg-navy-50 text-navy-400",
  waived: "bg-gold-50 text-gold-600",
  pending: "bg-navy-50 text-navy-500",
  verified: "bg-jade-50 text-jade-600",
  rejected: "bg-coral-500/10 text-coral-600",
  online: "bg-jade-50 text-jade-600",
  offline: "bg-navy-50 text-navy-400",
  flagged: "bg-coral-500/10 text-coral-600",
  qualified: "bg-jade-50 text-jade-600",
  rewarded: "bg-gold-50 text-gold-600",
};

export function StatusPill({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");
  return (
    <span className={cn("pill capitalize", STYLES[status] || "bg-navy-50 text-navy-500")}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
