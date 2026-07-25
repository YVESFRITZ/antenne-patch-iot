import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  await store.ensureLoaded();
  return NextResponse.json({
    stats: store.getStats(),
    alerts: store.getAlerts(),
    antennas: store.getAntennas(),
    sites: store.getSites(),
    thresholds: store.getThresholds(),
  });
}
