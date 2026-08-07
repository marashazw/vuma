"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Ride } from "@/lib/types";
import { CalendarClock, Bell, BellRing } from "lucide-react";
import Link from "next/link";

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000; // show upcoming trips within 24h
const LOCAL_NOTIFY_BEFORE_MS = 60 * 60 * 1000; // fire the local notification 1h before

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
  const [upcoming, setUpcoming] = useState<Ride[]>([]);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default");
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
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Re-render every minute so the countdown stays current without a
  // full data refetch.
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

  if (!upcoming.length) return null;

  const soonest = upcoming[0];
  const msUntil = new Date(soonest.scheduled_at!).getTime() - Date.now();

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
