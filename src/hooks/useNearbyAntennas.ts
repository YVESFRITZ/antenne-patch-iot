"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildQuery,
  parseOverpass,
  OVERPASS_URLS,
  type NearbyAntenna,
} from "@/lib/nearbyAntennas";
import { haversineDistance } from "@/lib/utils";

/**
 * Interroge Overpass directement depuis le navigateur.
 * Overpass autorise le CORS, et cette voie évite la limite de durée des
 * fonctions serveur (une requête peut dépasser 20 secondes).
 */
async function queryOverpassDirect(
  lat: number,
  lng: number,
  radius: number
): Promise<NearbyAntenna[]> {
  const url = `?data=${encodeURIComponent(buildQuery(lat, lng, radius))}`;
  let lastError: unknown = null;

  for (const endpoint of OVERPASS_URLS) {
    try {
      const res = await fetch(endpoint + url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      return parseOverpass(await res.json(), lat, lng);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Overpass indisponible");
}

/**
 * Antennes réelles (OpenStreetMap) autour de la position donnée.
 * La requête n'est relancée que si l'on s'est réellement déplacé, pour
 * ne pas solliciter inutilement le service public Overpass.
 */
export function useNearbyAntennas(
  position: { lat: number; lng: number } | null,
  radius: number,
  enabled: boolean
) {
  const [antennas, setAntennas] = useState<NearbyAntenna[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastQuery = useRef<{ lat: number; lng: number; radius: number } | null>(null);

  const load = useCallback(
    async (lat: number, lng: number, r: number) => {
      setLoading(true);
      setError(null);
      try {
        // Voie principale : le serveur interroge OpenStreetMap et met le
        // résultat en cache, ce qui rend les appels suivants immédiats.
        const res = await fetch(`/api/nearby?lat=${lat}&lng=${lng}&radius=${r}`);
        if (res.ok) {
          const data = await res.json();
          setAntennas(data.antennas ?? []);
          lastQuery.current = { lat, lng, radius: r };
          return;
        }

        // Le serveur a échoué (requête Overpass trop lente pour la durée
        // maximale d'une fonction) : on tente directement depuis le
        // navigateur, qui n'a pas cette contrainte.
        const found = await queryOverpassDirect(lat, lng, r);
        setAntennas(found);
        lastQuery.current = { lat, lng, radius: r };
      } catch {
        try {
          const found = await queryOverpassDirect(lat, lng, r);
          setAntennas(found);
          lastQuery.current = { lat, lng, radius: r };
        } catch {
          setError("Recherche des antennes réelles indisponible — réessayez plus tard");
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!enabled || !position) return;

    const previous = lastQuery.current;
    // On relance seulement après un déplacement notable (le quart du rayon)
    // ou si le rayon demandé a changé.
    const moved =
      !previous ||
      previous.radius !== radius ||
      haversineDistance(previous.lat, previous.lng, position.lat, position.lng) > radius / 4;

    if (moved) void load(position.lat, position.lng, radius);
  }, [enabled, position, radius, load]);

  const refresh = useCallback(() => {
    if (!position) return;
    lastQuery.current = null;
    void load(position.lat, position.lng, radius);
  }, [position, radius, load]);

  return { antennas, loading, error, refresh };
}
