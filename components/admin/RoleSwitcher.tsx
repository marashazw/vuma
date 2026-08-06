"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Car, User, Loader2 } from "lucide-react";
import { useModal } from "@/components/ui/ModalProvider";

export function RoleSwitcher() {
  const modal = useModal();
  const router = useRouter();
  const [switching, setSwitching] = useState<string | null>(null);

  async function switchTo(role: "driver" | "rider") {
    setSwitching(role);
    const res = await fetch("/api/admin/switch-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not switch view: ${data.error || "Unknown error"}`);
      setSwitching(null);
      return;
    }
    router.push(role === "driver" ? "/driver" : "/rider");
    router.refresh();
  }

  return (
    <div className="max-w-6xl mx-auto px-5 pt-4 flex items-center gap-2 text-sm">
      <span className="text-navy-400">View as:</span>
      <button
        className="btn-ghost !py-1.5 !px-3 text-xs"
        disabled={!!switching}
        onClick={() => switchTo("driver")}
      >
        {switching === "driver" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Car className="w-3.5 h-3.5" />} Driver
      </button>
      <button
        className="btn-ghost !py-1.5 !px-3 text-xs"
        disabled={!!switching}
        onClick={() => switchTo("rider")}
      >
        {switching === "rider" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <User className="w-3.5 h-3.5" />} Rider
      </button>
    </div>
  );
}
