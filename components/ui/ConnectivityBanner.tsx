"use client";

import { useEffect, useState } from "react";
import { WifiOff, AlertTriangle } from "lucide-react";

const PING_INTERVAL_MS = 15000;
const SLOW_THRESHOLD_MS = 4000;

type ConnectionState = "online" | "unstable" | "offline";

export function ConnectivityBanner() {
  const [state, setState] = useState<ConnectionState>("online");

  useEffect(() => {
    let cancelled = false;

    async function checkConnection() {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (!cancelled) setState("offline");
        return;
      }
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SLOW_THRESHOLD_MS);
        await fetch("/api/ping", { cache: "no-store", signal: controller.signal });
        clearTimeout(timeout);
        if (cancelled) return;
        setState(Date.now() - start > SLOW_THRESHOLD_MS ? "unstable" : "online");
      } catch {
        if (!cancelled) setState("unstable");
      }
    }

    checkConnection();
    const interval = setInterval(checkConnection, PING_INTERVAL_MS);

    function handleOffline() {
      setState("offline");
    }
    function handleOnline() {
      checkConnection();
    }
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (state === "online") return null;

  return (
    <div
      className={`px-5 py-3 text-white text-sm font-semibold flex items-center gap-2 ${
        state === "offline" ? "bg-coral-600" : "bg-coral-500"
      }`}
    >
      {state === "offline" ? <WifiOff className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
      <div>
        <p>{state === "offline" ? "Uh oh, offline?" : "Signal's a bit patchy"}</p>
        <p className="text-xs font-normal text-white/80">
          {state === "offline"
            ? "Showing your last known location — reconnect to search or request a ride."
            : "Things might take a little longer to load right now."}
        </p>
      </div>
    </div>
  );
}
