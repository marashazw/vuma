"use client";

import { useEffect, useState } from "react";

export function AppSplash() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // Runs only after hydration completes — this is precisely the gap
    // being bridged. A brief fade rather than an instant cut, so it
    // doesn't feel like a flash/glitch once the real app takes over.
    const timeout = setTimeout(() => setHidden(true), 150);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div
      id="app-splash"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0E1B2E",
        transition: "opacity 200ms ease-out",
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? "none" : "auto",
      }}
      aria-hidden={hidden}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "#F2A93B",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          fontWeight: 700,
          color: "#0E1B2E",
          marginBottom: 20,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        V
      </div>
      <p
        style={{
          color: "#F7F5F0",
          fontSize: 14,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          margin: 0,
        }}
      >
        Loading Vuma&hellip;
      </p>
    </div>
  );
}
