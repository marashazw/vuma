"use client";

import { useState } from "react";
import { Check, X, ChevronRight } from "lucide-react";

export function EditableLocationBadge({
  label,
  onSave,
  position = "top",
}: {
  label: string;
  onSave: (newLabel: string) => void;
  position?: "top" | "bottom";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function save() {
    onSave(draft.trim() || label);
    setEditing(false);
  }

  return (
    <div
      className={`absolute ${
        position === "top" ? "top-2" : "bottom-2"
      } left-1/2 -translate-x-1/2 w-[75%] max-w-[260px] z-[1000]`}
    >
      {editing ? (
        <div className="bg-white rounded-xl shadow-lg p-2 flex items-center gap-2">
          <input
            autoFocus
            className="input flex-1 !py-2 text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <button
            type="button"
            className="w-8 h-8 rounded-lg bg-jade-500 text-white flex items-center justify-center shrink-0"
            onClick={save}
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg bg-navy-100 text-navy-500 flex items-center justify-center shrink-0"
            onClick={() => setEditing(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="bg-white rounded-xl shadow-lg px-3 py-1.5 w-full text-left flex items-center justify-between gap-2"
          onClick={() => {
            setDraft(label);
            setEditing(true);
          }}
        >
          <p className="text-xs font-semibold text-navy-800 truncate min-w-0">{label}</p>
          <ChevronRight className="w-3.5 h-3.5 text-navy-300 shrink-0" />
        </button>
      )}
    </div>
  );
}
