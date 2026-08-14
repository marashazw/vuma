"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PaymentInstructions } from "@/lib/types";
import { ChevronDown, Landmark, ExternalLink } from "lucide-react";

export function PaymentOptionsAccordion({ country, walletLabel }: { country: string; walletLabel: string }) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState<PaymentInstructions | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!country) return;
    (async () => {
      const { data } = await supabase.from("payment_instructions").select("*").eq("country", country).maybeSingle();
      setInstructions(data as PaymentInstructions | null);
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  if (!loaded || !instructions) return null;

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-sm font-semibold text-navy-700 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-navy-400" /> Payment options — how to top up your {walletLabel}
        </span>
        <ChevronDown className={`w-4 h-4 text-navy-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-navy-100">
          <p className="text-xs text-navy-400 mb-3">
            Make your payment using the details below, then submit the reference code or a screenshot as proof —
            your {walletLabel} balance updates once an admin confirms it.
          </p>
          <div className="border border-navy-100 rounded-xl p-4 space-y-2">
            <p className="label mb-1">{instructions.method_label || "Mobile wallet transfer"}</p>
            {instructions.account_name && (
              <p className="text-sm">
                <span className="text-navy-400">To: </span>
                {instructions.account_name}
              </p>
            )}
            {instructions.account_number && <p className="text-sm font-mono font-semibold">{instructions.account_number}</p>}
            {instructions.instructions && <p className="text-xs text-navy-400 mt-1">{instructions.instructions}</p>}
            {instructions.link_url && (
              <a
                href={instructions.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-gold-600 font-semibold mt-2 underline"
              >
                <ExternalLink className="w-3.5 h-3.5" /> {instructions.link_label || "Open payment link"}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
