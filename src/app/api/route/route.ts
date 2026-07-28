import { NextRequest, NextResponse } from "next/server";

/**
 * Itinéraire routier entre deux points, via OSRM (moteur de routage
 * libre d'OpenStreetMap).
 *
 * Interrogé côté serveur : certaines connexions filtrent les services
 * tiers, alors que l'hébergeur les atteint sans difficulté.
 */

const OSRM_URL = "https://router.project-osrm.org/route/v1";
const MODES = ["driving", "walking"] as const;
type Mode = (typeof MODES)[number];

function parseCoord(value: string | null, max: number): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > max) return null;
  return n;
}

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;

  const fromLat = parseCoord(p.get("fromLat"), 90);
  const fromLng = parseCoord(p.get("fromLng"), 180);
  const toLat = parseCoord(p.get("toLat"), 90);
  const toLng = parseCoord(p.get("toLng"), 180);

  if (fromLat === null || fromLng === null || toLat === null || toLng === null) {
    return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 });
  }

  const requested = p.get("mode");
  const mode: Mode = MODES.includes(requested as Mode) ? (requested as Mode) : "driving";

  try {
    // OSRM attend les coordonnées en longitude,latitude.
    const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
    const res = await fetch(
      `${OSRM_URL}/${mode}/${coords}?overview=full&geometries=geojson`,
      {
        headers: { "User-Agent": "AntennePatch/1.0 (supervision IoT)" },
        // Marge sous la durée maximale d'une fonction sans serveur.
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Service d'itinéraire indisponible (${res.status})` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const first = data?.routes?.[0];
    if (!first?.geometry?.coordinates?.length) {
      return NextResponse.json(
        { error: "Aucune route ne relie ces deux points" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      path: (first.geometry.coordinates as [number, number][]).map(([lng, lat]) => ({
        lat,
        lng,
      })),
      distanceMeters: Math.round(first.distance),
      durationSeconds: Math.round(first.duration),
      mode,
    });
  } catch {
    return NextResponse.json(
      { error: "Service d'itinéraire injoignable" },
      { status: 502 }
    );
  }
}
