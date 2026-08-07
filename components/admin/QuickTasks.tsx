import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

interface PendingPerson {
  user_id: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
}

function personName(p: PendingPerson): string {
  const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
  return prof?.full_name || "Driver";
}

interface TaskGroup {
  label: string;
  count: number;
  href: string;
  urgent?: boolean;
  items?: { id: string; name: string }[];
}

export function QuickTasks({
  pendingSubs,
  pendingTopups,
  pendingVerifications,
  pendingDeluxe,
  activeSos,
  duplicateFlags,
  suspendedDrivers,
  pendingAppeals,
}: {
  pendingSubs: number;
  pendingTopups: number;
  pendingVerifications: PendingPerson[];
  pendingDeluxe: PendingPerson[];
  activeSos: number;
  duplicateFlags: number;
  suspendedDrivers: number;
  pendingAppeals: number;
}) {
  const groups: TaskGroup[] = [
    { label: "Active SOS alert", count: activeSos, href: "/admin/safety", urgent: true },
    {
      label: "Driver verification to review",
      count: pendingVerifications.length,
      href: "/admin/drivers",
      items: pendingVerifications.slice(0, 3).map((p) => ({ id: p.user_id, name: personName(p) })),
    },
    {
      label: "Vuma Deluxe application to review",
      count: pendingDeluxe.length,
      href: "/admin/drivers",
      items: pendingDeluxe.slice(0, 3).map((p) => ({ id: p.user_id, name: personName(p) })),
    },
    { label: "Subscription payment to approve", count: pendingSubs, href: "/admin/subscriptions" },
    { label: "Wallet top-up to approve", count: pendingTopups, href: "/admin/wallet-topups" },
    { label: "Suspension appeal to review", count: pendingAppeals, href: "/admin/appeals" },
    { label: "Duplicate vehicle plate flagged", count: duplicateFlags, href: "/admin/referrals" },
  ];

  const withAction = groups.filter((g) => g.count > 0);

  if (!withAction.length) {
    return (
      <div className="card p-5 flex items-center gap-3 bg-jade-50 border-jade-200">
        <CheckCircle2 className="w-5 h-5 text-jade-600 shrink-0" />
        <p className="text-sm text-jade-700">
          All caught up — nothing waiting on you right now.
          {suspendedDrivers > 0 && ` (${suspendedDrivers} driver${suspendedDrivers > 1 ? "s" : ""} currently suspended.)`}
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <p className="label mb-4">Quick Tasks</p>
      <div className="space-y-2">
        {withAction.map((g) => (
          <div
            key={g.label}
            className={`rounded-lg px-4 py-3 flex items-center justify-between gap-3 ${g.urgent ? "bg-coral-500/10" : "bg-navy-50"}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {g.urgent && <AlertTriangle className="w-4 h-4 text-coral-600 shrink-0" />}
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${g.urgent ? "text-coral-700" : "text-navy-700"}`}>
                  {g.count} {g.label}
                  {g.count > 1 ? "s" : ""}
                </p>
                {!!g.items?.length && (
                  <p className="text-xs text-navy-400 truncate">
                    {g.items.map((it, i) => (
                      <span key={it.id}>
                        <Link href={`/admin/drivers/${it.id}`} className="underline hover:text-navy-600">
                          {it.name}
                        </Link>
                        {i < g.items!.length - 1 ? ", " : ""}
                      </span>
                    ))}
                    {g.count > g.items.length && ` +${g.count - g.items.length} more`}
                  </p>
                )}
              </div>
            </div>
            <Link
              href={g.href}
              className={`text-xs font-semibold shrink-0 flex items-center gap-1 ${g.urgent ? "text-coral-600" : "text-gold-600"}`}
            >
              Review <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ))}
      </div>
      {suspendedDrivers > 0 && (
        <p className="text-xs text-navy-400 mt-3">
          {suspendedDrivers} driver{suspendedDrivers > 1 ? "s" : ""} currently suspended —{" "}
          <Link href="/admin/moderation" className="underline">
            view in Moderation
          </Link>
          .
        </p>
      )}
    </div>
  );
}
