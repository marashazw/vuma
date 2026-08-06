"use client";

import { useEffect, useState, useCallback, use } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { StatusPill } from "@/components/ui/StatusPill";
import { Loader2, Car, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

const RideMap = dynamic(() => import("@/components/map/RideMap"), { ssr: false });

interface TrackedRide {
  id: string;
  status: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  final_fare: number | null;
  currency: string;
  country: string;
  created_at: string;
  driver_name: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  plate_number: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
}

export default function PublicTrackPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient();
  const { id: rideId } = use(params);
  const [ride, setRide] = useState<TrackedRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("ride_tracking_public").select("*").eq("id", rideId).single();
    if (error || !data) {
      setNotFound(true);
    } else {
      setRide(data as TrackedRide);
    }
    setLoading(false);
  }, [rideId, supabase]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 5000);
    return () => clearInterval(poll);
  }, [load]);

  if (loading) {
    return (
      <main className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-navy-300" />
      </main>
    );
  }

  if (notFound || !ride) {
    return (
      <main className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 text-center gap-3">
        <Logo />
        <p className="text-navy-400 mt-4">This ride link isn't valid, or the ride is no longer active.</p>
      </main>
    );
  }

  const vehicle = [ride.vehicle_color, ride.vehicle_make, ride.vehicle_model].filter(Boolean).join(" ");

  return (
    <main className="min-h-screen bg-paper">
      <header className="px-5 py-4 border-b border-navy-100 flex items-center justify-between">
        <Logo />
        <StatusPill status={ride.status} />
      </header>

      <div className="max-w-2xl mx-auto p-5 space-y-5">
        <div className="card p-4 bg-navy-50 flex items-start gap-2 text-sm text-navy-500">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
          <p>Someone shared this Vuma ride with you so you can follow along. No account needed.</p>
        </div>

        <div className="card overflow-hidden h-64">
          <RideMap
            pickup={[ride.pickup_lat, ride.pickup_lng]}
            dropoff={[ride.dropoff_lat, ride.dropoff_lng]}
            driverLocation={ride.driver_lat && ride.driver_lng ? [ride.driver_lat, ride.driver_lng] : null}
          />
        </div>

        <div className="card p-5 space-y-3">
          <div>
            <p className="label mb-1">Pickup</p>
            <p className="text-sm">{ride.pickup_address}</p>
          </div>
          <div>
            <p className="label mb-1">Drop-off</p>
            <p className="text-sm">{ride.dropoff_address}</p>
          </div>
        </div>

        {ride.driver_name && (
          <div className="card p-5">
            <p className="label mb-2 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5" /> Driver
            </p>
            <p className="font-semibold">{ride.driver_name}</p>
            {vehicle && <p className="text-sm text-navy-400 mt-1">{vehicle}</p>}
            {ride.plate_number && <p className="text-sm text-navy-400">Plate: {ride.plate_number}</p>}
          </div>
        )}

        <p className="text-xs text-navy-300 text-center">
          Updates automatically &middot; started {format(new Date(ride.created_at), "d MMM, HH:mm")}
        </p>
      </div>
    </main>
  );
}
