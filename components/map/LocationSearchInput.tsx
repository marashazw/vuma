"use client";

import { useEffect, useRef, useState } from "react";
import { geocodeSearch, type GeocodeResult } from "@/lib/geo";
import { MapPin, Loader2 } from "lucide-react";

export function LocationSearchInput({
  placeholder,
  onSelect,
  countryCodes,
  bias,
}: {
  placeholder: string;
  onSelect: (result: GeocodeResult) => void;
  countryCodes?: string;
  /** Biases results toward this point (e.g. the rider's city center or
   * current pickup location) so search returns city-relevant matches
   * instead of scattering across the whole country. */
  bias?: { lat: number; lng: number };
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          onFocus={() => setOpen(true)}
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
