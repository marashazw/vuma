"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";

// Leaflet's default marker icons reference image paths that don't resolve
// under Next.js bundling — rebuild them as inline SVG data URIs instead.
function makeIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">
    <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="${color}"/>
    <circle cx="15" cy="15" r="6" fill="white"/>
  </svg>`;
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -36],
  });
}

const pickupIcon = L.divIcon({
  className: "",
  html: `<svg width="44" height="76" viewBox="0 0 44 76" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="0" width="40" height="40" rx="11" fill="#111827"/>
    <circle cx="22" cy="13" r="4.5" fill="white"/>
    <path d="M22 19c-4.5 0-7.8 3.4-7.8 8v2.5h13.4V27c0-2.7-1.1-5-2.8-6.6" fill="white"/>
    <path d="M25.5 20.5l6-6.5" stroke="white" stroke-width="3" stroke-linecap="round"/>
    <line x1="22" y1="40" x2="22" y2="64" stroke="#111827" stroke-width="2"/>
    <circle cx="22" cy="68" r="6" fill="#2563EB" stroke="white" stroke-width="2.5"/>
  </svg>`,
  iconSize: [44, 76],
  iconAnchor: [22, 68],
  popupAnchor: [0, -68],
});
const dropoffIcon = makeIcon("#FF6B5A");
const driverIcon = makeIcon("#F2A93B");
const stopIcon = makeIcon("#2E4A72");
const liveLocationIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#3B82F6;border:3px solid white;box-shadow:0 0 0 2px rgba(59,130,246,0.4)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function FitBounds({
  points,
  liveLocation,
  followLiveLocation,
}: {
  points: [number, number][];
  liveLocation?: [number, number] | null;
  followLiveLocation?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    // Before a full route exists (still choosing where to go), keep the
    // map tightly zoomed on and continuously following the rider's actual
    // live GPS position — not a static snapshot — so it doesn't drift out
    // of view as they move, especially important offline when only tiles
    // near the current position are likely to be cached.
    if (followLiveLocation && liveLocation) {
      map.setView(liveLocation, 17);
      return;
    }
    if (points.length >= 2) {
      map.fitBounds(points, { padding: [60, 60] });
    } else if (points.length === 1) {
      map.setView(points[0], 16);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, liveLocation?.[0], liveLocation?.[1], followLiveLocation, map]);
  return null;
}

export interface RideMapProps {
  pickup: [number, number];
  dropoff?: [number, number] | null;
  /** Intermediate stops between pickup and dropoff, in order. */
  stops?: [number, number][];
  driverLocation?: [number, number] | null;
  /** The rider's/driver's own continuously-updating current position — a
   * distinct blue dot, separate from the pickup pin (which is the chosen
   * request point, not necessarily where the device currently is). */
  liveLocation?: [number, number] | null;
  routeGeometry?: [number, number][] | null;
  className?: string;
  /** When true, the pickup pin can be dragged to fine-tune the exact spot. */
  editablePickup?: boolean;
  /** When true, the drop-off pin can be dragged to fine-tune the exact spot. */
  editableDropoff?: boolean;
  onPickupDrag?: (lat: number, lng: number) => void;
  onDropoffDrag?: (lat: number, lng: number) => void;
  /** Set false to center the map on `pickup` without showing a pin there —
   * for showing a live map before the rider has actually chosen a pickup
   * point, so the map is never blank on load. */
  showPickupMarker?: boolean;
  /** When true (and no dropoff is set), the map tightly follows
   * `liveLocation` continuously instead of the static pickup point — for
   * the "still choosing where to go" phase. Automatically stops following
   * once a real route exists so the full trip can be shown instead. */
  followLiveLocation?: boolean;
}

export default function RideMap({
  pickup,
  dropoff,
  stops = [],
  driverLocation,
  liveLocation,
  routeGeometry,
  className,
  editablePickup,
  editableDropoff,
  onPickupDrag,
  onDropoffDrag,
  showPickupMarker = true,
  followLiveLocation = false,
}: RideMapProps) {
  const points: [number, number][] = [pickup, ...stops, ...(dropoff ? [dropoff] : [])];

  return (
    <div className={className} style={{ height: "100%", width: "100%", borderRadius: 20, overflow: "hidden" }}>
      <MapContainer center={pickup} zoom={16} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {showPickupMarker && (
          <Marker
            position={pickup}
            icon={pickupIcon}
            draggable={!!editablePickup}
            eventHandlers={
              editablePickup && onPickupDrag
                ? {
                    dragend: (e) => {
                      const { lat, lng } = e.target.getLatLng();
                      onPickupDrag(lat, lng);
                    },
                  }
                : undefined
            }
          >
            <Popup>{editablePickup ? "Pickup — drag to adjust" : "Pickup"}</Popup>
          </Marker>
        )}
        {stops.map((stop, i) => (
          <Marker key={i} position={stop} icon={stopIcon}>
            <Popup>Stop {i + 1}</Popup>
          </Marker>
        ))}
        {dropoff && (
          <Marker
            position={dropoff}
            icon={dropoffIcon}
            draggable={!!editableDropoff}
            eventHandlers={
              editableDropoff && onDropoffDrag
                ? {
                    dragend: (e) => {
                      const { lat, lng } = e.target.getLatLng();
                      onDropoffDrag(lat, lng);
                    },
                  }
                : undefined
            }
          >
            <Popup>{editableDropoff ? "Drop-off — drag to adjust" : "Drop-off"}</Popup>
          </Marker>
        )}
        {driverLocation && (
          <Marker position={driverLocation} icon={driverIcon}>
            <Popup>Driver</Popup>
          </Marker>
        )}
        {liveLocation && <Marker position={liveLocation} icon={liveLocationIcon} />}
        {dropoff && routeGeometry && routeGeometry.length > 1 ? (
          <Polyline positions={routeGeometry} pathOptions={{ color: "#0E1B2E", weight: 4 }} />
        ) : (
          dropoff && <Polyline positions={points} pathOptions={{ color: "#0E1B2E", weight: 3, dashArray: "6 8" }} />
        )}
        <FitBounds points={points} liveLocation={liveLocation} followLiveLocation={followLiveLocation} />
      </MapContainer>
    </div>
  );
}
