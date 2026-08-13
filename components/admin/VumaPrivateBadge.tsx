import { Users } from "lucide-react";

const STYLES: Record<string, string> = {
  active: "bg-jade-50 text-jade-700 border-jade-200",
  pending: "bg-gold-50 text-gold-700 border-gold-200",
  lapsed: "bg-navy-50 text-navy-500 border-navy-100",
  revoked: "bg-coral-50 text-coral-600 border-coral-200",
};

const LABELS: Record<string, string> = {
  active: "Vuma Private member",
  pending: "Vuma Private — pending",
  lapsed: "Vuma Private — lapsed",
  revoked: "Vuma Private — revoked",
};

export function VumaPrivateBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-navy-50 text-navy-400 border-navy-100">
        <Users className="w-3 h-3" /> Not a Vuma Private member
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STYLES[status] || STYLES.lapsed}`}>
      <Users className="w-3 h-3" /> {LABELS[status] || status}
    </span>
  );
}
