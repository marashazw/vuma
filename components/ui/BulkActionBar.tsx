"use client";

import { Loader2 } from "lucide-react";

export function BulkActionBar({
  selectedCount,
  totalCount,
  allSelected,
  onToggleSelectAll,
  actions,
}: {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  actions: { label: string; onClick: () => void; danger?: boolean; busy?: boolean }[];
}) {
  if (!totalCount) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-navy-50 rounded-lg px-3 py-2 mb-2">
      <label className="flex items-center gap-2 text-xs text-navy-500 cursor-pointer">
        <input type="checkbox" className="w-4 h-4 accent-gold-400" checked={allSelected} onChange={onToggleSelectAll} />
        {selectedCount > 0 ? `${selectedCount} selected` : "Select all"}
      </label>
      {selectedCount > 0 && (
        <div className="flex items-center gap-2">
          {actions.map((a) => (
            <button
              key={a.label}
              className={`btn-ghost !py-1.5 !px-3 !text-xs ${a.danger ? "!text-coral-600" : ""}`}
              disabled={a.busy}
              onClick={a.onClick}
            >
              {a.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
