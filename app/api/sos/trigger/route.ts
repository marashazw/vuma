import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { haversineKm } from "@/lib/geo";
import { SOS_RESPONDER_COUNT } from "@/lib/constants";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { rideId, lat, lng } = await req.json();
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "Location is required to raise an SOS" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: triggeringProfile } = await admin.from("profiles").select("*").eq("id", user.id).single();
  if (!triggeringProfile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Snapshot the "other party" and vehicle details so the alert is self
  // contained even if records change later.
  let rideRow: any = null;
  let involvedDriverName: string | null = null;
  let involvedDriverPhone: string | null = null;
  let vehiclePlate: string | null = null;
  let vehicleDescription: string | null = null;
  let excludeDriverIds: string[] = [];

  if (rideId) {
    const { data: ride } = await admin.from("rides").select("*").eq("id", rideId).single();
    rideRow = ride;
    if (ride?.driver_id) {
      excludeDriverIds.push(ride.driver_id);
      const [{ data: driverProfile }, { data: driverPerson }] = await Promise.all([
        admin.from("driver_profiles").select("*").eq("user_id", ride.driver_id).single(),
        admin.from("profiles").select("*").eq("id", ride.driver_id).single(),
      ]);
      involvedDriverName = driverPerson?.full_name || null;
      involvedDriverPhone = driverPerson?.phone || null;
      vehiclePlate = driverProfile?.plate_number || null;
      vehicleDescription = [driverProfile?.vehicle_color, driverProfile?.vehicle_make, driverProfile?.vehicle_model]
        .filter(Boolean)
        .join(" ");
    }
  }

  const { data: alert, error: alertErr } = await admin
    .from("sos_alerts")
    .insert({
      ride_id: rideId || null,
      triggered_by: user.id,
      triggered_by_role: triggeringProfile.role,
      lat,
      lng,
      status: "active",
      involved_driver_name: involvedDriverName,
      involved_driver_phone: involvedDriverPhone,
      vehicle_plate: vehiclePlate,
      vehicle_description: vehicleDescription || null,
      is_deluxe: rideRow?.is_deluxe || false,
    })
    .select("*")
    .single();

  if (alertErr || !alert) return NextResponse.json({ error: alertErr?.message || "Could not create alert" }, { status: 500 });

  // Find the nearest online, verified drivers (excluding anyone already
  // directly involved in the ride) to notify and dispatch to the scene.
  const { data: candidates } = await admin
    .from("driver_profiles")
    .select("user_id, current_lat, current_lng")
    .eq("is_online", true)
    .eq("verification_status", "verified")
    .not("current_lat", "is", null)
    .not("current_lng", "is", null);

  const ranked = (candidates || [])
    .filter((d) => !excludeDriverIds.includes(d.user_id) && d.user_id !== user.id)
    .map((d) => ({
      driver_id: d.user_id,
      distance_km: haversineKm(lat, lng, d.current_lat!, d.current_lng!),
    }))
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, SOS_RESPONDER_COUNT);

  if (ranked.length) {
    await admin.from("sos_responses").insert(
      ranked.map((r) => ({
        sos_alert_id: alert.id,
        driver_id: r.driver_id,
        distance_km: Math.round(r.distance_km * 10) / 10,
        status: "notified",
      }))
    );
  }

  return NextResponse.json({
    ok: true,
    alertId: alert.id,
    notifiedDrivers: ranked.length,
    country: triggeringProfile.country,
  });
}
