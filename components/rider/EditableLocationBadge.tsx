"use client";

import { useState } from "react";
import { Check, X, ChevronRight } from "lucide-react";

// Vuma only operates in South Africa and Zimbabwe, so a small, known list
// is enough here — geocoded addresses typically end with province and/or
// country ("...Waterfalls, Harare, Zimbabwe"), which is redundant clutter
// on a small badge where the rider already knows what country they're in.
// Display-only: the full label is still what's saved and sent to the
// driver, this just trims what's shown in this specific compact spot.
const COUNTRIES_TO_STRIP = ["Zimbabwe", "South Africa"];
const PROVINCES_TO_STRIP = [
  "Gauteng",
  "Western Cape",
  "Eastern Cape",
  "KwaZulu-Natal",
  "Free State",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Harare Province",
  "Bulawayo Province",
  "Manicaland",
  "Mashonaland Central",
  "Mashonaland East",
  "Mashonaland West",
  "Masvingo Province",
  "Masvingo",
  "Matabeleland North",
  "Matabeleland South",
  "Midlands Province",
  "Midlands",
];

function trimProvinceCountry(label: string): string {
  const parts = label.split(",").map((p) => p.trim());
  while (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (COUNTRIES_TO_STRIP.includes(last) || PROVINCES_TO_STRIP.includes(last)) {
      parts.pop();
    } else {
      break;
    }
  }
  return parts.join(", ");
}

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
          <p className="text-xs font-semibold text-navy-800 truncate min-w-0">{trimProvinceCountry(label)}</p>
          <ChevronRight className="w-3.5 h-3.5 text-navy-300 shrink-0" />
        </button>
      )}
    </div>
  );
}
