import { NextResponse } from "next/server";

// Deliberately does nothing but respond — used by ConnectivityBanner to
// measure round-trip time as a proxy for "is the connection actually good
// right now," not just "is there a network interface up" (which is all
// navigator.onLine alone can tell you).
export async function GET() {
  return NextResponse.json({ ok: true });
}
