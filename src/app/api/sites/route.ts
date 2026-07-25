import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { SiteInput } from "@/lib/types";

export async function GET() {
  await store.ensureLoaded();
  return NextResponse.json(store.getSites());
}

/** Valide les coordonnées et les champs obligatoires d'un site. */
function validate(body: Partial<SiteInput>, requireAll: boolean): string | null {
  if (requireAll && !body.name?.trim()) return "Le nom du site est obligatoire";
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
    const body = (await request.json()) as SiteInput;
    const error = validate(body, true);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const site = await store.addSite({
      name: body.name.trim(),
      address: body.address?.trim() ?? "",
      lat: body.lat,
      lng: body.lng,
      description: body.description?.trim() ?? "",
    });
    return NextResponse.json({ success: true, site });
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide" }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  await store.ensureLoaded();
  try {
    const body = (await request.json()) as Partial<SiteInput> & { id?: string };
    if (!body.id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    const error = validate(body, false);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const { id, ...patch } = body;
    const site = await store.updateSite(id, patch);
    if (!site) return NextResponse.json({ error: "Site introuvable" }, { status: 404 });
    return NextResponse.json({ success: true, site });
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  await store.ensureLoaded();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const removed = await store.deleteSite(id);
  if (!removed) return NextResponse.json({ error: "Site introuvable" }, { status: 404 });
  return NextResponse.json({ success: true });
}
