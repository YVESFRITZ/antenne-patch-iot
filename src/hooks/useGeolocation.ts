"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy?: number;
  source: "gps" | "ip" | "default";
}

// Position de repli ultime (Paris) si GPS et IP échouent tous les deux.
const DEFAULT_POSITION: GeoPosition = {
  lat: 48.8566,
  lng: 2.3522,
  source: "default",
};

// Précision (m) jugée suffisante : on arrête d'affiner le GPS en dessous.
const GOOD_ACCURACY_M = 40;
// Durée max d'affinage continu du GPS.
const REFINE_MS = 25000;
// Délai avant de tenter un repli IP si aucun point GPS n'est encore arrivé.
const IP_FALLBACK_MS = 12000;

/** Estimation par IP via plusieurs fournisseurs (repli si le GPS échoue). */
async function fetchIpLocation(): Promise<GeoPosition | null> {
  const providers: Array<() => Promise<GeoPosition | null>> = [
    async () => {
      const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return null;
      const d = await res.json();
      if (d.latitude && d.longitude) {
        return { lat: d.latitude, lng: d.longitude, accuracy: 5000, source: "ip" };
      }
      return null;
    },
    async () => {
      const res = await fetch("https://ipwho.is/", { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return null;
      const d = await res.json();
      if (d.success && d.latitude && d.longitude) {
        return { lat: d.latitude, lng: d.longitude, accuracy: 5000, source: "ip" };
      }
      return null;
    },
  ];

  for (const provider of providers) {
    try {
      const pos = await provider();
      if (pos) return pos;
    } catch {
      // fournisseur suivant
    }
  }
  return null;
}

export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const watchId = useRef<number | null>(null);
  const refineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bestAccuracy = useRef<number>(Infinity);

  const clearAll = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (refineTimer.current) {
      clearTimeout(refineTimer.current);
      refineTimer.current = null;
    }
    if (ipTimer.current) {
      clearTimeout(ipTimer.current);
      ipTimer.current = null;
    }
  }, []);

  const applyIpFallback = useCallback(async (message?: string) => {
    const ipPos = await fetchIpLocation();
    // Ne pas écraser un vrai point GPS déjà obtenu entre-temps.
    if (bestAccuracy.current !== Infinity) return;
    if (ipPos) {
      setPosition(ipPos);
      setError(message ?? "Position estimée via IP — autorisez le GPS pour plus de précision");
      setLoading(false);
      return;
    }
    setPosition(DEFAULT_POSITION);
    setError("Position par défaut — autorisez la géolocalisation du navigateur");
    setLoading(false);
  }, []);

  const startGps = useCallback(
    (forceFresh: boolean) => {
      clearAll();
      bestAccuracy.current = Infinity;

      if (typeof navigator === "undefined" || !navigator.geolocation) {
        applyIpFallback("Géolocalisation non supportée — position estimée via IP");
        return;
      }

      const onReading = (pos: GeolocationPosition) => {
        const acc = pos.coords.accuracy ?? Infinity;
        // Ne conserver que des lectures plus (ou aussi) précises.
        if (acc <= bestAccuracy.current) {
          bestAccuracy.current = acc;
          setPosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            source: "gps",
          });
          setLoading(false);
          setError(null);
        }
        // Précision suffisante : inutile de continuer à affiner.
        if (acc <= GOOD_ACCURACY_M) clearAll();
      };

      const onFail = (err: GeolocationPositionError) => {
        // Permission refusée : le GPS ne reviendra pas, repli IP immédiat.
        if (err.code === 1) {
          clearAll();
          applyIpFallback(
            "Accès à la position refusé — autorisez la localisation dans le navigateur (position estimée via IP)"
          );
        }
        // Codes 2/3 (indisponible / délai) : on laisse le watch continuer,
        // le repli IP éventuel est géré par le minuteur ci-dessous.
      };

      watchId.current = navigator.geolocation.watchPosition(onReading, onFail, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: forceFresh ? 0 : 30000,
      });

      // Si aucun point GPS après IP_FALLBACK_MS, estimer via IP en attendant
      // (le GPS surclassera automatiquement dès qu'un vrai point arrive).
      ipTimer.current = setTimeout(() => {
        if (bestAccuracy.current === Infinity) applyIpFallback();
      }, IP_FALLBACK_MS);

      // Arrêt de l'affinage continu après REFINE_MS.
      refineTimer.current = setTimeout(clearAll, REFINE_MS);
    },
    [applyIpFallback, clearAll]
  );

  useEffect(() => {
    startGps(false);
    return clearAll;
  }, [startGps, clearAll]);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    startGps(true);
  }, [startGps]);

  return { position, loading, error, refresh };
}
