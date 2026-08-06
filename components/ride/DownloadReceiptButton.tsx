"use client";

import type { Ride } from "@/lib/types";
import { currencyFormat } from "@/lib/commission";
import { FileDown } from "lucide-react";
import { format } from "date-fns";

export function DownloadReceiptButton({
  ride,
  driverName,
  vehicleLabel,
  plate,
}: {
  ride: Ride;
  driverName?: string | null;
  vehicleLabel?: string | null;
  plate?: string | null;
}) {
  async function download() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Receipt card occupies 60% of the page width, centered horizontally.
    // Height hugs the actual content instead of a fixed guess, so nothing
    // gets clipped or leaves awkward empty space.
    const frameWidth = pageWidth * 0.6;
    const frameX = (pageWidth - frameWidth) / 2;
    const centerX = frameX + frameWidth / 2;
    const innerPadding = 22;
    const contentWidth = frameWidth - innerPadding * 2;

    const topY = pageHeight * 0.12;
    let y = topY + 40;

    // Wordmark
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 69, 0); // orange-red
    doc.text("Vuma", centerX, y, { align: "center" });

    y += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(130, 152, 182); // navy-300
    doc.text("Agree on your fare.", centerX, y, { align: "center" });

    y += 18;
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.6);
    doc.line(frameX + innerPadding, y, frameX + frameWidth - innerPadding, y);
    y += 28;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(14, 27, 46); // navy-800
    doc.text("Ride Receipt", centerX, y, { align: "center" });
    y += 24;

    const row = (label: string, value: string) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(150, 160, 175);
      doc.text(label.toUpperCase(), centerX, y, { align: "center" });
      y += 11;
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      const lines = doc.splitTextToSize(value, contentWidth - 20);
      lines.forEach((line: string) => {
        doc.text(line, centerX, y, { align: "center" });
        y += 12;
      });
      y += 9;
    };

    row("Receipt / Ride ID", ride.id);
    row("Date", format(new Date(ride.completed_at || ride.created_at), "d MMMM yyyy, HH:mm"));
    row("Pickup", ride.pickup_address);
    row("Drop-off", ride.dropoff_address);
    if (ride.distance_km) row("Distance", `${Number(ride.distance_km).toFixed(1)} km`);
    if (driverName) row("Driver", driverName);
    if (vehicleLabel || plate) row("Vehicle", [vehicleLabel, plate ? `Plate: ${plate}` : null].filter(Boolean).join(" — "));

    y += 2;
    doc.setDrawColor(230, 230, 230);
    doc.line(frameX + innerPadding, y, frameX + frameWidth - innerPadding, y);
    y += 28;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(150, 160, 175);
    doc.text("TOTAL FARE", centerX, y, { align: "center" });
    y += 22;
    doc.setFontSize(19);
    doc.setTextColor(14, 27, 46);
    doc.text(currencyFormat(Number(ride.final_fare ?? ride.rider_offer), ride.currency), centerX, y, { align: "center" });

    y += 30;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    const noteLines = doc.splitTextToSize(
      ride.applied_credit_id
        ? "This ride was covered by a referral credit — no cash payment was due."
        : "Fare settled directly between rider and driver.",
      contentWidth - 20
    );
    noteLines.forEach((line: string) => {
      doc.text(line, centerX, y, { align: "center" });
      y += 10;
    });

    y += 18;
    doc.setFontSize(7.5);
    doc.setTextColor(180, 180, 180);
    doc.text("Thank you for riding with Vuma.", centerX, y, { align: "center" });

    // Border frame drawn last, sized to hug the actual content.
    const bottomY = y + 24;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(1);
    doc.roundedRect(frameX, topY, frameWidth, bottomY - topY, 14, 14, "S");

    doc.save(`vuma-receipt-${ride.id.slice(0, 8)}.pdf`);
  }

  return (
    <button className="btn-ghost w-full" onClick={download}>
      <FileDown className="w-4 h-4" /> Download PDF receipt
    </button>
  );
}
