"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useModal } from "@/components/ui/ModalProvider";

export function BackToAdminBar({ currentlyViewing }: { currentlyViewing: "driver" | "rider" }) {
  const router = useRouter();
  const modal = useModal();
  const [switching, setSwitching] = useState(false);

  async function backToAdmin() {
    setSwitching(true);
    const res = await fetch("/api/admin/switch-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not switch back: ${data.error || "Unknown error"}`);
      setSwitching(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="bg-navy-800 text-paper px-5 py-2 flex items-center justify-between text-sm">
      <span className="flex items-center gap-1.5 text-navy-300">
        <ShieldCheck className="w-4 h-4 text-gold-400" /> Viewing as {currentlyViewing} (super-admin)
      </span>
      <button className="text-gold-400 font-semibold hover:text-gold-300" disabled={switching} onClick={backToAdmin}>
        {switching ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Back to Admin"}
      </button>
    </div>
  );
}
