import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { AntennaInput } from "@/lib/types";

const TYPES = ["LoRa", "4G", "WiFi", "Satellite"] as const;

export async function GET() {
  await store.ensureLoaded();
  return NextResponse.json(store.getAntennas());
}

/** Valide les champs d'une antenne. */
function validate(body: Partial<AntennaInput>, requireAll: boolean): string | null {
  if (requireAll && !body.name?.trim()) return "Le nom de l'antenne est obligatoire";
  if (requireAll && !body.siteId) return "Le site est obligatoire";
  if (body.type && !TYPES.includes(body.type)) return "Type d'antenne inconnu";
  if (body.lat !== undefined && (typeof body.lat !== "number" || Math.abs(body.lat) > 90))
    return "Latitude invalide (entre -90 et 90)";
  if (body.lng !== undefined && (typeof body.lng !== "number" || Math.abs(body.lng) > 180))
    return "Longitude invalide (entre -180 et 180)";
  if (requireAll && (body.lat === undefined || body.lng === undefined))
    return "Coordonnées obligatoires";
  return null;
}

export async function POST(request: NextRequest) {
  await store.ensureLoaded();
  try {
    const body = (await request.json()) as AntennaInput;
    const error = validate(body, true);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const antenna = await store.addAntenna({
      siteId: body.siteId,
      name: body.name.trim(),
      type: body.type ?? "LoRa",
      lat: body.lat,
      lng: body.lng,
      firmware: body.firmware?.trim(),
    });
    if (!antenna) return NextResponse.json({ error: "Site introuvable" }, { status: 404 });
    return NextResponse.json({ success: true, antenna });
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide" }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  await store.ensureLoaded();
  try {
    const body = (await request.json()) as Partial<AntennaInput> & { id?: string };
    if (!body.id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    const error = validate(body, false);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const { id, ...patch } = body;
    const antenna = await store.updateAntenna(id, patch);
    if (!antenna)
      return NextResponse.json({ error: "Antenne ou site introuvable" }, { status: 404 });
    return NextResponse.json({ success: true, antenna });
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  await store.ensureLoaded();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const removed = await store.deleteAntenna(id);
  if (!removed) return NextResponse.json({ error: "Antenne introuvable" }, { status: 404 });
  return NextResponse.json({ success: true });
}
