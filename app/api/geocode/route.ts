import { NextRequest, NextResponse } from "next/server";

const UA = "Vuma-Rideshare-App/1.0 (contact: support@example.com)";
const LOCATIONIQ_KEY = process.env.LOCATIONIQ_API_KEY;
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Country-code -> Google "region code" bias (soft hint, helps ranking) AND
// the full country name as it appears in Google's formattedAddress, used
// below as a hard post-filter — regionCode alone does NOT exclude other
// countries, it only nudges ranking, which was letting results from
// neighboring countries slip through despite the intended restriction.
const REGION_CODE: Record<string, string> = { za: "ZA", zw: "ZW" };
const COUNTRY_NAME: Record<string, string> = { za: "South Africa", zw: "Zimbabwe" };

// Same pattern as the country-level fix above: Google's locationBias/bounds
// params are soft ranking nudges, not hard restrictions, so a query like
// "Cresta" was still pulling in Bulawayo results despite biasing toward
// Harare. This is a hard, guaranteed distance filter applied after the
// fact — no dependency on Google honoring the bias strongly enough.
const CITY_RADIUS_KM = 60; // generous metro-area buffer

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function googleTextSearch(q: string, countrycodes: string, bias?: { lat: number; lng: number }) {
  const codes = countrycodes.split(",").map((c) => c.trim().toLowerCase());
  const region = REGION_CODE[codes[0]] || undefined;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_KEY!,
      "X-Goog-FieldMask": "places.formattedAddress,places.location,places.displayName",
    },
    body: JSON.stringify({
      textQuery: q,
      ...(region ? { regionCode: region } : {}),
      // City-level bias (not just country) — strongly favors results near
      // the rider's own city (e.g. Harare specifically, not all of
      // Zimbabwe), on top of the hard country-name filter below.
      ...(bias
        ? { locationBias: { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 40000 } } }
        : {}),
    }),
  });
  if (!res.ok) throw new Error(`Google Places returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const results = (data.places || []).map((p: any) => ({
    label: p.formattedAddress || p.displayName?.text || q,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    precise: false,
  }));

  const allowedNames = codes.map((c) => COUNTRY_NAME[c]).filter(Boolean);
  if (!allowedNames.length) return results;
  return results.filter((r: { label: string }) => allowedNames.some((name) => r.label.includes(name!)));
}

/**
 * The classic Geocoding API's forward search (`address=`) is purpose-built
 * for resolving structured addresses — including house numbers — precisely.
 * Text Search (New) is optimized for finding places/landmarks by loose
 * phrase and was regularly matching just the street, not the specific
 * number, even when the number was typed. Geocoding API's `location_type`
 * field tells us definitively whether a result is an exact address match
 * (ROOFTOP/RANGE_INTERPOLATED) versus only a road/area-level guess
 * (GEOMETRIC_CENTER/APPROXIMATE), which is what lets us confidently rank
 * precise matches first below.
 */
async function googleGeocodingSearch(q: string, countrycodes: string, bias?: { lat: number; lng: number }) {
  const codes = countrycodes.split(",").map((c) => c.trim().toLowerCase());
  const region = REGION_CODE[codes[0]] || undefined;
  // Geocoding API biases via a viewport (`bounds`), not a circle — build a
  // rough ~40km box around the city center as a bias hint (not a hard
  // restriction; the country-name filter below still enforces the hard
  // boundary regardless of how this nudges ranking).
  let boundsParam = "";
  if (bias) {
    const dLat = 40000 / 111000; // ~40km in degrees latitude
    const dLng = 40000 / (111000 * Math.cos((bias.lat * Math.PI) / 180));
    boundsParam = `&bounds=${bias.lat - dLat},${bias.lng - dLng}|${bias.lat + dLat},${bias.lng + dLng}`;
  }
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}${
    region ? `&region=${region.toLowerCase()}` : ""
  }${boundsParam}&key=${GOOGLE_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Geocoding search returned ${res.status}`);
  const data = await res.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google Geocoding search status: ${data.status}`);
  }
  const results = (data.results || []).map((r: any) => ({
    label: r.formatted_address,
    lat: r.geometry?.location?.lat,
    lng: r.geometry?.location?.lng,
    precise: r.geometry?.location_type === "ROOFTOP" || r.geometry?.location_type === "RANGE_INTERPOLATED",
  }));

  const allowedNames = codes.map((c) => COUNTRY_NAME[c]).filter(Boolean);
  if (!allowedNames.length) return results;
  return results.filter((r: { label: string }) => allowedNames.some((name) => r.label.includes(name!)));
}

async function googleReverseGeocode(lat: string, lng: string) {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`
  );
  if (!res.ok) throw new Error(`Google Geocoding returned ${res.status}`);
  const data = await res.json();
  if (data.status !== "OK") throw new Error(`Google Geocoding status: ${data.status}`);
  return data.results?.[0]?.formatted_address || null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reverse = searchParams.get("reverse");
  const countrycodes = searchParams.get("countrycodes") || "za,zw";
  const debug = searchParams.get("debug") === "1";
  let googleError: string | null = null;

  try {
    if (reverse) {
      const lat = searchParams.get("lat")!;
      const lng = searchParams.get("lng")!;

      // Tier 1: Google Geocoding (best accuracy, requires GOOGLE_PLACES_API_KEY)
      if (GOOGLE_KEY) {
        try {
          const label = await googleReverseGeocode(lat, lng);
          if (label) return NextResponse.json({ label });
        } catch (err: any) {
          googleError = err?.message || String(err);
          console.error("[/api/geocode] Google reverse failed, falling back:", err);
        }
      }

      // Tier 2/3: LocationIQ or raw Nominatim
      const url = LOCATIONIQ_KEY
        ? `https://us1.locationiq.com/v1/reverse?key=${LOCATIONIQ_KEY}&lat=${lat}&lon=${lng}&format=json`
        : `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, LOCATIONIQ_KEY ? undefined : { headers: { "User-Agent": UA } });
      const text = await res.text();
      if (!res.ok) {
        if (res.status === 404 || res.status === 429) {
          return NextResponse.json({ label: null, ...(debug && googleError ? { _googleError: googleError } : {}) });
        }
        throw new Error(`Geocoder returned ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = JSON.parse(text);
      return NextResponse.json({
        label: data.display_name || null,
        ...(debug && googleError ? { _googleError: googleError } : {}),
      });
    }

    const q = searchParams.get("q");
    if (!q) return NextResponse.json({ results: [] });

    const biasLat = searchParams.get("biasLat");
    const biasLng = searchParams.get("biasLng");
    const bias = biasLat && biasLng ? { lat: parseFloat(biasLat), lng: parseFloat(biasLng) } : undefined;

    // Tier 1: Google. Two endpoints run in parallel — Geocoding API for
    // precise structured address matches (house numbers), Text Search for
    // places/landmarks/intersections it handles better. Precise address
    // matches are ranked first since that's what riders usually want when
    // they've typed a specific number.
    if (GOOGLE_KEY) {
      try {
        const [geocodingResults, textResults] = await Promise.all([
          googleGeocodingSearch(q, countrycodes, bias).catch(() => []),
          googleTextSearch(q, countrycodes, bias).catch(() => []),
        ]);

        const seen = new Set<string>();
        let merged = [...geocodingResults, ...textResults].filter((r) => {
          const key = `${r.label}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Hard city-radius filter — see CITY_RADIUS_KM comment above for why
        // the bias params alone aren't enough.
        if (bias) {
          merged = merged.filter(
            (r) => r.lat != null && r.lng != null && haversineKm(bias.lat, bias.lng, r.lat, r.lng) <= CITY_RADIUS_KM
          );
        }

        merged.sort((a, b) => Number(b.precise) - Number(a.precise));

        if (merged.length) {
          return NextResponse.json({ results: merged.slice(0, 8).map(({ precise, ...r }) => r) });
        }
      } catch (err: any) {
        googleError = err?.message || String(err);
        console.error("[/api/geocode] Google search failed, falling back:", err);
      }
    }

    // Tier 2/3: LocationIQ (if configured) or raw Nominatim as the final,
    // always-available free fallback.
    const url = LOCATIONIQ_KEY
      ? `https://us1.locationiq.com/v1/search?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(
          q
        )}&countrycodes=${countrycodes}&format=json&limit=6`
      : `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          q
        )}&countrycodes=${countrycodes}&limit=6`;

    const res = await fetch(url, LOCATIONIQ_KEY ? undefined : { headers: { "User-Agent": UA } });
    const text = await res.text();

    if (!res.ok) {
      // 404 from LocationIQ/Nominatim just means "no results for this
      // query" — that's a normal, expected outcome (e.g. a half-typed
      // address), not a failure. Only genuine errors should 502.
      if (res.status === 404) {
        return NextResponse.json({ results: [], ...(debug && googleError ? { _googleError: googleError } : {}) });
      }
      if (res.status === 429) {
        console.warn("[/api/geocode] rate limited by fallback geocoder:", text.slice(0, 200));
        return NextResponse.json({ results: [], ...(debug && googleError ? { _googleError: googleError } : {}) });
      }
      throw new Error(`Geocoder returned ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = JSON.parse(text);

    const results = (data as any[]).map((d) => ({
      label: d.display_name,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
    }));

    return NextResponse.json({ results, ...(debug && googleError ? { _googleError: googleError } : {}) });
  } catch (err: any) {
    console.error("[/api/geocode] request failed:", err?.cause || err?.message || err);
    return NextResponse.json(
      { error: "Geocoding service unavailable", ...(debug && googleError ? { _googleError: googleError } : {}) },
      { status: 502 }
    );
  }
}
