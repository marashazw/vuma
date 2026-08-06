"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Ride, DriverProfile } from "@/lib/types";
import { MessageCircle } from "lucide-react";

export function ShareRideButton({ ride, driver }: { ride: Ride; driver?: DriverProfile | null }) {
  const supabase = createClient();
  const [driverName, setDriverName] = useState<string | null>(null);

  useEffect(() => {
    if (!ride.driver_id) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", ride.driver_id).single();
      setDriverName(data?.full_name || null);
    })();
  }, [ride.driver_id, supabase]);

  function share() {
    const trackUrl = `${window.location.origin}/track/${ride.id}`;

    let message = `I'm on a Vuma ride from ${ride.pickup_address} to ${ride.dropoff_address}`;

    if (driver) {
      const vehicle = [driver.vehicle_color, driver.vehicle_make, driver.vehicle_model].filter(Boolean).join(" ");
      message += `.\nDriver: ${driverName || "assigned"}`;
      if (vehicle) message += ` (${vehicle}${driver.plate_number ? `, plate ${driver.plate_number}` : ""})`;
      else if (driver.plate_number) message += ` (plate ${driver.plate_number})`;
    }

    message += `.\nTrack my ride live: ${trackUrl}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  }

  return (
    <button className="btn-ghost w-full" onClick={share}>
      <MessageCircle className="w-4 h-4" /> Share my ride on WhatsApp
    </button>
  );
}
