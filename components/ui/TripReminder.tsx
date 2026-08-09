"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Ride } from "@/lib/types";
import { CalendarClock, Bell, BellRing, Check, AlertTriangle, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { useModal } from "@/components/ui/ModalProvider";

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000; // show upcoming trips within 24h
const LOCAL_NOTIFY_BEFORE_MS = 60 * 60 * 1000; // fire the local notification 1h before
const NO_SHOW_REPORT_GRACE_MIN = 10; // matches ScheduledCancelPanel's own threshold

function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

export function TripReminder({ role }: { role: "rider" | "driver" }) {
  const supabase = createClient();
  const router = useRouter();
  const modal = useModal();
  const [upcoming, setUpcoming] = useState<Ride[]>([]);
  const [disputeBusy, setDisputeBusy] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default");
  // Tracks a "not yet" response per ride, purely to switch the copy from a
  // question to an acknowledgement — this is a local UI state, not written
  // anywhere, since the only thing that actually matters is the driver's
  // real Start Trip tap or the rider's real no-show report.
  const [notYetRideIds, setNotYetRideIds] = useState<Set<string>>(new Set());
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    } else {
      setNotifPermission("unsupported");
    }

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const column = role === "rider" ? "rider_id" : "driver_id";
      const { data } = await supabase
        .from("rides")
        .select("*")
        .eq(column, user.id)
        .eq("is_scheduled", true)
        .eq("status", "accepted")
        .gte("scheduled_at", new Date().toISOString())
        .lte("scheduled_at", new Date(Date.now() + REMINDER_WINDOW_MS).toISOString())
        .order("scheduled_at", { ascending: true });
      setUpcoming((data as Ride[]) || []);

      // A rider should see a driver's arrival confirmation immediately,
      // not only after their next full reload — that's the whole point
      // of surfacing it as an urgent dialog rather than a routine banner.
      if (role === "rider") {
        const channel = supabase
          .channel("rider-scheduled-arrival")
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "rides", filter: `rider_id=eq.${user.id}` },
            (payload) => {
              const updated = payload.new as Ride;
              setUpcoming((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            }
          )
          .subscribe();
        return () => {
          supabase.removeChannel(channel);
        };
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Re-render every minute so the countdown (and the arrival-prompt
  // escalation to a no-show report) stays current without a full refetch.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // Local browser notifications — deliberately scoped: this only fires
  // while the app/tab is genuinely open (foreground or backgrounded),
  // never when it's been fully closed. A true "wakes the device even when
  // closed" push notification would need separate infrastructure (VAPID
  // keys, a service worker push handler, a server-side scheduler) that
  // isn't wired up here — this is the honest, achievable middle ground.
  useEffect(() => {
    if (notifPermission !== "granted" || !upcoming.length) return;
    const timers = upcoming.map((ride) => {
      const msUntilNotify = new Date(ride.scheduled_at!).getTime() - LOCAL_NOTIFY_BEFORE_MS - Date.now();
      if (msUntilNotify <= 0) return null;
      return setTimeout(() => {
        new Notification("Vuma — upcoming scheduled trip", {
          body: `Your trip to ${ride.dropoff_address.split(",")[0]} is in about 1 hour.`,
          icon: "/icon-512.png",
        });
      }, msUntilNotify);
    });
    return () => timers.forEach((t) => t && clearTimeout(t));
  }, [notifPermission, upcoming]);

  async function enableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  }

  async function cancelDisputedTrip(rideId: string, isNoShowReport: boolean) {
    const confirmMessage = isNoShowReport
      ? "Report your driver as a no-show? They said they'd arrived, but if they genuinely aren't there, this flags their account rather than yours."
      : "Cancel this trip? Since your driver has already confirmed arrival, cancelling now may flag your account as a late cancellation.";
    const ok = await modal.confirm(confirmMessage, { confirmLabel: isNoShowReport ? "Report no-show" : "Yes, cancel", danger: true });
    if (!ok) return;

    setDisputeBusy(true);
    await fetch(`/api/rides/${rideId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: isNoShowReport ? "Reported no-show despite driver's arrival confirmation" : "Rider cancelled after driver's arrival confirmation",
        noShowReport: isNoShowReport,
      }),
    });
    setDisputeBusy(false);
    setUpcoming((prev) => prev.filter((r) => r.id !== rideId));
  }

  if (!upcoming.length) return null;

  const soonest = upcoming[0];
  const msUntil = new Date(soonest.scheduled_at!).getTime() - Date.now();
  const isPastScheduledTime = msUntil <= 0;
  const minutesPast = isPastScheduledTime ? Math.abs(msUntil) / 60000 : 0;
  const saidNotYet = notYetRideIds.has(soonest.id);

  // Once the scheduled time has actually arrived, the banner switches from
  // a countdown to an arrival-confirmation prompt — different for each
  // role, since a rider and driver need different questions answered.
  if (isPastScheduledTime) {
    if (role === "driver") {
      return (
        <div className="card p-4 bg-navy-800 text-white">
          <div className="flex items-center gap-2.5 mb-3">
            <CalendarClock className="w-5 h-5 text-gold-400 shrink-0" />
            <p className="text-sm font-semibold">Have you arrived at the pickup for {soonest.dropoff_address.split(",")[0]}?</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn-ghost !text-sm !bg-transparent !text-navy-200 !border-navy-600"
              onClick={() => setNotYetRideIds((prev) => new Set(prev).add(soonest.id))}
            >
              Not yet
            </button>
            <button
              className="btn-primary !text-sm"
              onClick={async () => {
                await supabase.from("rides").update({ driver_confirmed_arrival_at: new Date().toISOString() }).eq("id", soonest.id);
                router.push(`/driver/rides/${soonest.id}`);
              }}
            >
              <Check className="w-4 h-4" /> Yes, I'm here
            </button>
          </div>
          {saidNotYet && <p className="text-xs text-navy-300 mt-2">No rush — let us know once you're there.</p>}
        </div>
      );
    }

    // Rider side: if the driver has explicitly confirmed arrival, that's
    // a stronger, more specific signal than just "the scheduled time has
    // passed" — surfaced immediately rather than waiting out the normal
    // grace period, since the driver has already made a claim the rider
    // may want to dispute right away (wrong location, mistaken tap, etc.)
    if (soonest.driver_confirmed_arrival_at) {
      return (
        <div className="card p-4 bg-navy-800 text-white">
          <div className="flex items-center gap-2.5 mb-3">
            <AlertTriangle className="w-5 h-5 text-gold-400 shrink-0" />
            <p className="text-sm font-semibold">
              Your driver says they've arrived for {soonest.dropoff_address.split(",")[0]} — is that right?
            </p>
          </div>
          <Link href={`/rider/rides/${soonest.id}`} className="btn-primary w-full !text-sm text-center block mb-2">
            <Check className="w-4 h-4 inline mr-1" /> Yes, they're here
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn-ghost !text-sm !bg-transparent !text-navy-200 !border-navy-600"
              disabled={disputeBusy}
              onClick={() => cancelDisputedTrip(soonest.id, false)}
            >
              {disputeBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel"}
            </button>
            <button className="btn-danger !text-sm" disabled={disputeBusy} onClick={() => cancelDisputedTrip(soonest.id, true)}>
              {disputeBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Report no-show"}
            </button>
          </div>
        </div>
      );
    }

    // Rider side: ask if the driver has arrived, escalating to a no-show
    // report option once genuinely past the grace period — matches the
    // same 10-minute threshold ScheduledCancelPanel itself uses for its
    // own "report no-show" button, so the two stay consistent.
    const pastGracePeriod = minutesPast >= NO_SHOW_REPORT_GRACE_MIN;
    return (
      <div className="card p-4 bg-navy-800 text-white">
        <div className="flex items-center gap-2.5 mb-3">
          {pastGracePeriod ? (
            <AlertTriangle className="w-5 h-5 text-coral-400 shrink-0" />
          ) : (
            <CalendarClock className="w-5 h-5 text-gold-400 shrink-0" />
          )}
          <p className="text-sm font-semibold">
            {pastGracePeriod
              ? `Your driver hasn't arrived for ${soonest.dropoff_address.split(",")[0]}`
              : `Is your driver here for ${soonest.dropoff_address.split(",")[0]}?`}
          </p>
        </div>
        {pastGracePeriod ? (
          <Link href={`/rider/rides/${soonest.id}`} className="btn-danger w-full !text-sm">
            Report driver no-show
          </Link>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn-ghost !text-sm !bg-transparent !text-navy-200 !border-navy-600"
              onClick={() => setNotYetRideIds((prev) => new Set(prev).add(soonest.id))}
            >
              Not yet
            </button>
            <Link href={`/rider/rides/${soonest.id}`} className="btn-primary !text-sm text-center">
              <Check className="w-4 h-4 inline mr-1" /> Yes, they're here
            </Link>
          </div>
        )}
        {!pastGracePeriod && saidNotYet && (
          <p className="text-xs text-navy-300 mt-2">
            If they're still not here in {Math.max(Math.ceil(NO_SHOW_REPORT_GRACE_MIN - minutesPast), 1)} min, you'll be
            able to report it.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="card p-4 bg-navy-800 text-white flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <CalendarClock className="w-5 h-5 text-gold-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            Upcoming: {soonest.dropoff_address.split(",")[0]} in {formatCountdown(msUntil)}
          </p>
          {upcoming.length > 1 && (
            <p className="text-xs text-navy-300">+{upcoming.length - 1} more scheduled trip{upcoming.length > 2 ? "s" : ""} today</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {notifPermission !== "unsupported" && notifPermission !== "granted" && (
          <button
            onClick={enableNotifications}
            className="text-xs text-gold-400 flex items-center gap-1 hover:text-gold-300"
            title="Fires a reminder 1 hour before — only while this app is open, not if fully closed"
          >
            <Bell className="w-3.5 h-3.5" /> Set reminder
          </button>
        )}
        {notifPermission === "granted" && <BellRing className="w-3.5 h-3.5 text-jade-400" />}
        <Link href={`/${role}/rides/${soonest.id}`} className="text-xs font-semibold text-white underline">
          View
        </Link>
      </div>
    </div>
  );
}

