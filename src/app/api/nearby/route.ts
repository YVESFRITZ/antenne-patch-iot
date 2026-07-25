import { NextRequest, NextResponse } from "next/server";
import { getNearbyAntennas, MAX_RADIUS_M } from "@/lib/nearbyAntennas";

/**
 * Antennes réelles (OpenStreetMap) autour d'une position.
 * Interrogé côté serveur : cela évite les restrictions navigateur et
 * permet de mutualiser le cache entre les utilisateurs.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const radius = Number(params.get("radius") ?? 10000);

  if (!Number.isFinite(lat) || Math.abs(lat) > 90) {
    return NextResponse.json({ error: "Latitude invalide" }, { status: 400 });
  }
  if (!Number.isFinite(lng) || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Longitude invalide" }, { status: 400 });
  }

  const safeRadius = Number.isFinite(radius)
    ? Math.min(Math.max(radius, 500), MAX_RADIUS_M)
    : 10000;

  try {
    const { antennas, cached } = await getNearbyAntennas(lat, lng, safeRadius);
    return NextResponse.json({
      count: antennas.length,
      radius: safeRadius,
      cached,
      source: "OpenStreetMap",
      antennas,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Service OpenStreetMap indisponible : ${err.message}`
            : "Service OpenStreetMap indisponible",
      },
      { status: 502 }
    );
  }
}
