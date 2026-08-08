"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DriverNotice } from "@/lib/types";
import { ExternalLink } from "lucide-react";

export function DriverNoticeRail({ position }: { position: "left" | "right" }) {
  const supabase = createClient();
  const [notices, setNotices] = useState<DriverNotice[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("driver_notices")
        .select("*")
        .eq("position", position)
        .eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false });
      setNotices((data as DriverNotice[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  if (!notices.length) return null;

  return (
    <div className="space-y-4">
      {notices.map((n) => (
        <div key={n.id} className="card p-4">
          <p className="text-[11px] font-semibold text-gold-600 uppercase tracking-wide mb-1.5">{n.label}</p>
          <p className="font-semibold text-sm text-navy-800">{n.title}</p>
          {n.body && <p className="text-xs text-navy-500 mt-1.5 leading-relaxed">{n.body}</p>}
          {n.link_url && (
            <a
              href={n.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-gold-600 flex items-center gap-1 mt-2.5 hover:text-gold-700"
            >
              {n.link_label || "Learn more"} <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
