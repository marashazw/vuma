import type { CountryCode } from "./types";

/** Great-circle distance in km between two lat/lng points. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Suggested "fair range" for the rider, shown as guidance only — the
 * rider always types their own real offer. Pass real road distance
 * (from getRoadRoute) and the current admin-configured fare settings for
 * this country (see FareSettings / the fare_settings table).
 */
export function suggestedFareRange(
  roadKm: number,
  baseFare: number,
  perKm: number,
  lowMultiplier = 0.85,
  highMultiplier = 1.2,
  roundTo = 1
): { low: number; mid: number; high: number } {
  const mid = baseFare + roadKm * perKm;
  // Round to the nearest `roundTo` increment (e.g. nearest $1 for Zimbabwe,
  // nearest R5 for South Africa) — round numbers are easier to negotiate
  // around than odd cent values.
  const roundToIncrement = (n: number) => Math.round(n / roundTo) * roundTo;
  return {
    low: roundToIncrement(mid * lowMultiplier),
    mid: roundToIncrement(mid),
    high: roundToIncrement(mid * highMultiplier),
  };
}

export interface RoadRoute {
  distanceKm: number;
  durationMin: number;
  geometry: [number, number][]; // [lat, lng] pairs, ready for a Polyline
}

/**
 * Real road-distance/duration via OSRM, with an automatic straight-line
 * fallback (padded 25% to roughly approximate roads) if the routing
 * service is unreachable — the app keeps working either way, just with
 * less precise numbers.
 */
export async function getRoadRoute(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
  country: CountryCode,
  stops: { lat: number; lng: number }[] = []
): Promise<RoadRoute & { estimated: boolean }> {
  try {
    const stopsParam = stops.length ? `&stops=${encodeURIComponent(JSON.stringify(stops))}` : "";
    const res = await fetch(
      `/api/route?pLat=${pickup.lat}&pLng=${pickup.lng}&dLat=${dropoff.lat}&dLng=${dropoff.lng}${stopsParam}`
    );
    if (!res.ok) throw new Error("routing failed");
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return { ...data, estimated: false };
  } catch {
    // Straight-line fallback: sum each leg (pickup -> stop1 -> ... -> dropoff)
    // rather than a single pickup-to-dropoff line, so a multi-stop trip's
    // estimated distance/duration doesn't collapse to "as the crow flies"
    // between only the first and last points.
    const legs = [pickup, ...stops, dropoff];
    let straightKm = 0;
    for (let i = 0; i < legs.length - 1; i++) {
      straightKm += haversineKm(legs[i].lat, legs[i].lng, legs[i + 1].lat, legs[i + 1].lng);
    }
    const roadKm = straightKm * 1.25;
    return {
      distanceKm: roadKm,
      durationMin: (roadKm / 30) * 60, // rough guess at 30 km/h average
      geometry: legs.map((p) => [p.lat, p.lng] as [number, number]),
      estimated: true,
    };
  }
}

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

/**
 * Free-tier geocoding via OpenStreetMap Nominatim, called through our own
 * /api/geocode proxy (keeps the required User-Agent header server-side and
 * avoids CORS issues). Biased toward South Africa / Zimbabwe by default.
 */
export async function geocodeSearch(
  query: string,
  countryCodes = "za,zw",
  bias?: { lat: number; lng: number }
): Promise<GeocodeResult[]> {
  if (!query || query.trim().length < 3) return [];
  const biasParam = bias ? `&biasLat=${bias.lat}&biasLng=${bias.lng}` : "";
  const res = await fetch(
    `/api/geocode?q=${encodeURIComponent(query)}&countrycodes=${countryCodes}${biasParam}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string | null> {
  const res = await fetch(`/api/geocode?reverse=1&lat=${lat}&lng=${lng}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.label || null;
}
