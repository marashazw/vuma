import { NextRequest, NextResponse } from "next/server";

// Open-Meteo — free, no API key required. Matches the app's existing
// pattern of preferring free/no-key services (OSM tiles, Nominatim) where
// a paid alternative isn't already in use for another reason.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  if (!lat || !lng) return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,weather_code&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
    const data = await res.json();

    return NextResponse.json({
      tempC: data.current?.temperature_2m ?? null,
      precipitationMm: data.current?.precipitation ?? null,
      weatherCode: data.current?.weather_code ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: "Weather service unavailable" }, { status: 502 });
  }
}
