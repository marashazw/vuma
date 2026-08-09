"use client";

import { useEffect, useRef, useState } from "react";
import { geocodeSearch, type GeocodeResult } from "@/lib/geo";
import { MapPin, Loader2 } from "lucide-react";

export function LocationSearchInput({
  value,
  placeholder,
  onSelect,
  onTextChange,
  countryCodes,
  bias,
}: {
  /** The current address text, if a location is already set — shown as
   * the field's real, editable value rather than a mere placeholder hint.
   * Previously the selected address only ever showed as a grayed-out
   * placeholder, meaning there was nothing there to actually edit. */
  value?: string;
  placeholder: string;
  onSelect: (result: GeocodeResult) => void;
  /** Fired when the rider edits the text directly and it isn't a fresh
   * geocoded selection — e.g. adding a house number the search couldn't
   * find. Keeps whatever coordinates are already set; only the label
   * text changes. Omit to disable freeform editing (e.g. for a location
   * that isn't set yet, where there's nothing to attach edited text to). */
  onTextChange?: (text: string) => void;
  countryCodes?: string;
  /** Biases results toward this point (e.g. the rider's city center or
   * current pickup location) so search returns city-relevant matches
   * instead of scattering across the whole country. */
  bias?: { lat: number; lng: number };
}) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the field synced to the external value — but only while the
  // rider isn't actively typing in it, so an external update (e.g. a
  // drag-to-adjust reverse-geocode) doesn't fight their edit mid-keystroke.
  useEffect(() => {
    if (!focused) setQuery(value || "");
  }, [value, focused]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const r = await geocodeSearch(query, countryCodes, bias);
      setResults(r);
      setLoading(false);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, countryCodes, bias?.lat, bias?.lng]);

  function commitFreeformEdit() {
    const trimmed = query.trim();
    if (onTextChange && trimmed && trimmed !== value) {
      onTextChange(trimmed);
    } else if (!trimmed) {
      // Don't leave the field empty if they cleared it without picking a
      // new result — revert to the last real value instead.
      setQuery(value || "");
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300" />
        <input
          className="input pl-9"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onBlur={() => {
            setFocused(false);
            setOpen(false);
            commitFreeformEdit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commitFreeformEdit();
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300 animate-spin" />}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full card max-h-64 overflow-auto py-1">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 hover:bg-navy-50 text-sm text-navy-700"
                // Prevents the input's onBlur from firing (and reverting
                // the query) before this click registers.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery(r.label);
                  setResults([]);
                  setOpen(false);
                  onSelect(r);
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
