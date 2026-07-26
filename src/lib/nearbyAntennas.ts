import { haversineDistance } from "./utils";

/**
 * Antennes réelles issues d'OpenStreetMap (pylônes, tours de
 * télécommunication, mâts). Données ouvertes, sans clé d'API.
 *
 * Ces antennes appartiennent aux opérateurs : elles sont affichées à
 * titre d'information sur l'environnement radio, et ne sont pas des
 * modules supervisés par l'application.
 */

export interface NearbyAntenna {
  /** Identifiant OpenStreetMap, ex. "node/123456". */
  id: string;
  lat: number;
  lng: number;
  /** mast, tower, communications_tower… */
  kind: string;
  /** Type de pylône si renseigné (communication, radio…). */
  towerType?: string;
  operator?: string;
  name?: string;
  /** Distance depuis le point interrogé, en mètres. */
  distanceMeters: number;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/** Rayon maximal interrogeable, pour rester raisonnable avec le service public. */
export const MAX_RADIUS_M = 25000;
const DEFAULT_LIMIT = 120;

export interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export const OVERPASS_URLS = OVERPASS_ENDPOINTS;

/** Transforme une réponse Overpass en antennes triées par distance. */
export function parseOverpass(
  data: { elements?: OverpassElement[] },
  lat: number,
  lng: number
): NearbyAntenna[] {
  return (data.elements ?? [])
    .map((e) => toAntenna(e, lat, lng))
    .filter((a): a is NearbyAntenna => a !== null)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export function buildQuery(lat: number, lng: number, radius: number): string {
  const around = `around:${radius},${lat},${lng}`;
  // Pylônes, tours et mâts de télécommunication, en nœuds comme en contours.
  return `[out:json][timeout:20];(
node["man_made"="mast"](${around});
node["man_made"="communications_tower"](${around});
node["man_made"="tower"]["tower:type"~"communication|radio"](${around});
way["man_made"="mast"](${around});
way["man_made"="communications_tower"](${around});
);out center ${DEFAULT_LIMIT};`;
}

export function toAntenna(
  element: OverpassElement,
  lat: number,
  lng: number
): NearbyAntenna | null {
  const eLat = element.lat ?? element.center?.lat;
  const eLng = element.lon ?? element.center?.lon;
  if (typeof eLat !== "number" || typeof eLng !== "number") return null;

  const tags = element.tags ?? {};
  return {
    id: `${element.type}/${element.id}`,
    lat: eLat,
    lng: eLng,
    kind: tags.man_made ?? "mast",
    towerType: tags["tower:type"],
    operator: tags.operator,
    name: tags.name,
    distanceMeters: Math.round(haversineDistance(lat, lng, eLat, eLng)),
  };
}

/**
 * Interroge OpenStreetMap pour les antennes réelles autour d'un point.
 * Les serveurs Overpass sont publics : on bascule sur le second en cas
 * d'indisponibilité du premier.
 */
export async function fetchNearbyAntennas(
  lat: number,
  lng: number,
  radius: number
): Promise<NearbyAntenna[]> {
  const query = buildQuery(lat, lng, Math.min(radius, MAX_RADIUS_M));
  const url = `?data=${encodeURIComponent(query)}`;

  let lastError: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint + url, {
        headers: {
          // Overpass exige un agent identifiable et refuse certains clients.
          "User-Agent": "AntennePatch/1.0 (supervision IoT)",
          Accept: "application/json",
        },
        // Les fonctions sans serveur sont limitées à une dizaine de
        // secondes : on abandonne juste avant, pour renvoyer une erreur
        // exploitable plutôt que de se faire couper net.
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { elements?: OverpassElement[] };
      return parseOverpass(data, lat, lng);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Service OpenStreetMap indisponible");
}

/* ------------------------------------------------------------------ */
/* Cache mémoire : évite de solliciter Overpass à chaque rafraîchissement */
/* ------------------------------------------------------------------ */

interface CacheEntry {
  at: number;
  antennas: NearbyAntenna[];
}

const CACHE_TTL_MS = 6 * 3600_000;
const cache = new Map<string, CacheEntry>();

/** Clé arrondie à ~100 m : les positions voisines partagent le même résultat. */
function cacheKey(lat: number, lng: number, radius: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)},${radius}`;
}

export async function getNearbyAntennas(
  lat: number,
  lng: number,
  radius: number
): Promise<{ antennas: NearbyAntenna[]; cached: boolean }> {
  const key = cacheKey(lat, lng, radius);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { antennas: hit.antennas, cached: true };
  }

  const antennas = await fetchNearbyAntennas(lat, lng, radius);
  cache.set(key, { at: Date.now(), antennas });
  // Le cache reste petit : on purge les entrées les plus anciennes.
  if (cache.size > 40) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  return { antennas, cached: false };
}
