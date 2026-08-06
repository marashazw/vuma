import { NextRequest, NextResponse } from "next/server";

// Free public OSRM demo server. Fine for development and light production
// traffic; if you outgrow it, self-host OSRM or swap in Mapbox/Google
// Directions (see README "Upgrading routing").
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pLat = searchParams.get("pLat");
  const pLng = searchParams.get("pLng");
  const dLat = searchParams.get("dLat");
  const dLng = searchParams.get("dLng");
  const stopsParam = searchParams.get("stops"); // optional JSON: [{"lat":..,"lng":..}, ...]

  if (!pLat || !pLng || !dLat || !dLng) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }

  let stops: { lat: number; lng: number }[] = [];
  if (stopsParam) {
    try {
      stops = JSON.parse(stopsParam);
    } catch {
      // Ignore malformed stops rather than failing the whole route request.
    }
  }

  try {
    const waypoints = [
      `${pLng},${pLat}`,
      ...stops.map((s) => `${s.lng},${s.lat}`),
      `${dLng},${dLat}`,
    ].join(";");
    const url = `${OSRM_BASE}/${waypoints}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== "Ok" || !data.routes?.[0]) {
      return NextResponse.json({ error: "No route found", fallback: true }, { status: 502 });
    }

    const route = data.routes[0];
    const geometry: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );

    return NextResponse.json({
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      geometry,
    });
  } catch (err) {
    return NextResponse.json({ error: "Routing service unavailable", fallback: true }, { status: 502 });
  }
}
