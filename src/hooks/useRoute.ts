"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Itinéraire routier entre deux points, calculé par OSRM — le moteur de
 * routage libre d'OpenStreetMap. Service public, sans clé d'API.
 *
 * À distinguer de la liaison radio : celle-ci est une ligne droite (les
 * ondes ne suivent pas les routes). L'itinéraire répond à une autre
 * question : comment se rendre physiquement sur place.
 */

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteResult {
  /** Tracé suivant les routes, du départ à l'arrivée. */
  path: RoutePoint[];
  /** Distance par la route, en mètres. */
  distanceMeters: number;
  /** Durée estimée du trajet, en secondes. */
  durationSeconds: number;
}

const OSRM_URL = "https://router.project-osrm.org/route/v1";

export type TravelMode = "driving" | "walking";

/** Appel direct à OSRM, utilisé seulement si le serveur a échoué. */
async function fetchDirect(
  a: RoutePoint,
  b: RoutePoint,
  travel: TravelMode
): Promise<RouteResult> {
  const coords = `${a.lng},${a.lat};${b.lng},${b.lat}`;
  const res = await fetch(
    `${OSRM_URL}/${travel}/${coords}?overview=full&geometries=geojson`,
    { signal: AbortSignal.timeout(20000) }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  const first = data?.routes?.[0];
  if (!first?.geometry?.coordinates?.length) throw new Error("aucune route");

  return {
    path: (first.geometry.coordinates as [number, number][]).map(([lng, lat]) => ({
      lat,
      lng,
    })),
    distanceMeters: Math.round(first.distance),
    durationSeconds: Math.round(first.duration),
  };
}

export function useRoute(
  from: RoutePoint | null,
  to: RoutePoint | null,
  mode: TravelMode,
  enabled: boolean
) {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (a: RoutePoint, b: RoutePoint, travel: TravelMode) => {
      setLoading(true);
      setError(null);
      try {
        // Voie principale : le serveur interroge OSRM. Certaines
        // connexions filtrent les services tiers, pas l'hébergeur.
        const params = new URLSearchParams({
          fromLat: String(a.lat),
          fromLng: String(a.lng),
          toLat: String(b.lat),
          toLng: String(b.lng),
          mode: travel,
        });
        const res = await fetch(`/api/route?${params}`);
        if (res.ok) {
          const data = await res.json();
          setRoute({
            path: data.path,
            distanceMeters: data.distanceMeters,
            durationSeconds: data.durationSeconds,
          });
          return;
        }

        const failure = await res.json().catch(() => ({}));
        if (res.status === 404) {
          setError(failure.error ?? "Aucune route ne relie ces deux points");
          setRoute(null);
          return;
        }

        // Secours : tentative directe depuis le navigateur.
        setRoute(await fetchDirect(a, b, travel));
      } catch {
        try {
          setRoute(await fetchDirect(a, b, travel));
        } catch {
          setError("Service d'itinéraire injoignable");
          setRoute(null);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!enabled || !from || !to) {
      setRoute(null);
      setError(null);
      return;
    }
    void load(from, to, mode);
  }, [enabled, from?.lat, from?.lng, to?.lat, to?.lng, mode, load]);

  return { route, loading, error };
}

/** Durée lisible : « 12 min », « 1 h 25 ». */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}
