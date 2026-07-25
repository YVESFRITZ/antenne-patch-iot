import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { currentBackend } from "@/lib/persistence";
import type { Thresholds } from "@/lib/types";

export async function GET() {
  await store.ensureLoaded();
  return NextResponse.json({
    thresholds: store.getThresholds(),
    storage: currentBackend(),
  });
}

export async function PUT(request: NextRequest) {
  await store.ensureLoaded();
  try {
    const body = (await request.json()) as Partial<Thresholds>;
    const numeric: Partial<Thresholds> = {};

    for (const key of [
      "lowBattery",
      "highTemperature",
      "weakSignal",
      "offlineAfterSeconds",
    ] as const) {
      const value = body[key];
      if (value !== undefined) {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          return NextResponse.json({ error: `Valeur invalide pour ${key}` }, { status: 400 });
        }
        numeric[key] = value;
      }
    }

    const thresholds = await store.updateThresholds(numeric);
    return NextResponse.json({ success: true, thresholds, storage: currentBackend() });
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide" }, { status: 400 });
  }
}
