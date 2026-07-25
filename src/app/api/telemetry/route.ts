import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { authorizeDevice } from "@/lib/apiAuth";
import type { AntennaPayload } from "@/lib/types";

export async function GET(request: NextRequest) {
  await store.ensureLoaded();
  const antennaId = request.nextUrl.searchParams.get("antennaId");
  if (!antennaId) {
    return NextResponse.json({ error: "antennaId requis" }, { status: 400 });
  }
  return NextResponse.json(store.getTelemetry(antennaId));
}

export async function POST(request: NextRequest) {
  // Les modules doivent présenter la clé API (en-tête x-api-key).
  const auth = authorizeDevice(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  await store.ensureLoaded();

  try {
    const payload: AntennaPayload = await request.json();

    if (!payload.antennaId) {
      return NextResponse.json({ error: "antennaId requis" }, { status: 400 });
    }

    const updated = store.receiveAntennaPayload(payload);
    if (!updated) {
      return NextResponse.json({ error: "Antenne introuvable" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Télémétrie reçue",
      antenna: updated,
    });
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide" }, { status: 400 });
  }
}
