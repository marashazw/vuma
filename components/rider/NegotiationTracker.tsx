"use client";

import { currencyFormat } from "@/lib/commission";
import { cn } from "@/lib/utils";

export function NegotiationTracker({
  riderOffer,
  driverOffer,
  currency,
  matched,
}: {
  riderOffer: number;
  driverOffer: number | null;
  currency: string;
  matched: boolean;
}) {
  const values = [riderOffer, driverOffer ?? riderOffer];
  const min = Math.min(...values) * 0.9;
  const max = Math.max(...values) * 1.1;
  const span = Math.max(max - min, 1);

  const riderPos = ((riderOffer - min) / span) * 100;
  const driverPos = driverOffer !== null ? ((driverOffer - min) / span) * 100 : riderPos;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <p className="label">Negotiation</p>
        {matched && (
          <span className="pill bg-jade-50 text-jade-600">
            <span className="w-1.5 h-1.5 rounded-full bg-current" /> Matched
          </span>
        )}
      </div>

      <div className="relative h-24">
        {/* track line */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-navy-100" />

        {/* connecting segment between the two offers */}
        <div
          className={cn(
            "absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full transition-all duration-700",
            matched ? "bg-jade-400" : "bg-gold-300"
          )}
          style={{
            left: `${Math.min(riderPos, driverPos)}%`,
            width: `${Math.abs(driverPos - riderPos)}%`,
          }}
        />

        {/* rider bubble */}
        <div
          className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-700"
          style={{ left: `${riderPos}%` }}
        >
          <div className="w-14 h-14 rounded-full bg-navy-800 text-paper flex items-center justify-center text-[11px] font-mono font-semibold shadow-md">
            {currencyFormat(riderOffer, currency).replace(/\.00$/, "")}
          </div>
          <span className="text-[10px] text-navy-400 mt-1 font-semibold uppercase tracking-wide">
            You
          </span>
        </div>

        {/* driver bubble */}
        {driverOffer !== null && (
          <div
            className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center-reverse transition-all duration-700"
            style={{ left: `${driverPos}%` }}
          >
            <span className="text-[10px] text-navy-400 mb-1 font-semibold uppercase tracking-wide order-2">
              Driver
            </span>
            <div
              className={cn(
                "w-14 h-14 rounded-full text-white flex items-center justify-center text-[11px] font-mono font-semibold shadow-md order-1",
                matched ? "bg-jade-500" : "bg-gold-400 text-navy-900"
              )}
            >
              {currencyFormat(driverOffer, currency).replace(/\.00$/, "")}
            </div>
          </div>
        )}
      </div>

      {driverOffer === null && (
        <p className="text-sm text-navy-400 mt-4">Waiting for a driver to respond to your offer&hellip;</p>
      )}
    </div>
  );
}
