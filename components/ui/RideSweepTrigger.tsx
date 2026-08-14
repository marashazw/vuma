"use client";

import { useEffect } from "react";

/**
 * Fires both opportunistic ride sweeps once per mount, fire-and-forget.
 * Deliberately placed at the layout level (not just the main dashboard
 * page) — previously these only ran from /driver and /rider specifically,
 * meaning anyone navigating straight to another page under either section
 * (e.g. a bookmarked /driver/wallet link) would never trigger them at
 * all, no matter how many times they reloaded that specific page.
 */
export function RideSweepTrigger() {
  useEffect(() => {
    fetch("/api/rides/sweep-stale-negotiations", { method: "POST" }).catch(() => {});
    fetch("/api/rides/sweep-abandoned-scheduled", { method: "POST" }).catch(() => {});
    fetch("/api/vuma-private/sweep-expired-requests", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}
