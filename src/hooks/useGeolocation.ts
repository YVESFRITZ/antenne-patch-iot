"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { haversineDistance } from "@/lib/utils";

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy?: number;
  source: "gps" | "ip" | "default";
  /** Vitesse en m/s si fournie par l'appareil. */
  speed?: number | null;
  /** Horodatage de la lecture. */
  timestamp?: number;
}

// Position de repli ultime (Paris) si GPS et IP échouent tous les deux.
const DEFAULT_POSITION: GeoPosition = {
  lat: 48.8566,
  lng: 2.3522,
  source: "default",
};

// Déplacement (m) à partir duquel on considère que l'utilisateur a bougé
// pour de vrai, et non que le GPS a simplement dérivé.
const MOVEMENT_THRESHOLD_M = 25;
// Au-delà de cette ancienneté, on accepte toute nouvelle lecture même
// moins précise : mieux vaut une position fraîche qu'un point périmé.
const STALE_FIX_MS = 20000;
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
  /** true tant que le suivi GPS continu est actif. */
  const [tracking, setTracking] = useState(false);

  const watchId = useRef<number | null>(null);
  const ipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Dernier point GPS retenu, pour décider d'accepter la lecture suivante. */
  const lastFix = useRef<{ lat: number; lng: number; accuracy: number; at: number } | null>(null);

  const stopWatch = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (ipTimer.current) {
      clearTimeout(ipTimer.current);
      ipTimer.current = null;
    }
    setTracking(false);
  }, []);

  const applyIpFallback = useCallback(async (message?: string) => {
    const ipPos = await fetchIpLocation();
    // Ne pas écraser un vrai point GPS obtenu entre-temps.
    if (lastFix.current) return;
    if (ipPos) {
      setPosition(ipPos);
      setError(message ?? "Position estimée via IP — autorisez le GPS pour le suivi temps réel");
      setLoading(false);
      return;
    }
    setPosition(DEFAULT_POSITION);
    setError("Position par défaut — autorisez la géolocalisation du navigateur");
    setLoading(false);
  }, []);

  const startGps = useCallback(
    (forceFresh: boolean) => {
      stopWatch();
      if (forceFresh) lastFix.current = null;

      if (typeof navigator === "undefined" || !navigator.geolocation) {
        applyIpFallback("Géolocalisation non supportée — position estimée via IP");
        return;
      }

      const onReading = (pos: GeolocationPosition) => {
        const acc = pos.coords.accuracy ?? 9999;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const now = Date.now();
        const prev = lastFix.current;

        // Décider si cette lecture doit remplacer la précédente.
        let accept = true;
        if (prev) {
          const moved = haversineDistance(prev.lat, prev.lng, lat, lng);
          const hasMoved = moved > Math.max(MOVEMENT_THRESHOLD_M, acc);
          const isMorePrecise = acc <= prev.accuracy;
          const isStale = now - prev.at > STALE_FIX_MS;
          // On garde la lecture si l'utilisateur s'est réellement déplacé,
          // si elle est plus précise, ou si le point courant est périmé.
          accept = hasMoved || isMorePrecise || isStale;
        }

        if (!accept) return;

        lastFix.current = { lat, lng, accuracy: acc, at: now };
        setPosition({
          lat,
          lng,
          accuracy: pos.coords.accuracy,
          source: "gps",
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        });
        setLoading(false);
        setError(null);
      };

      const onFail = (err: GeolocationPositionError) => {
        // Permission refusée : le GPS ne reviendra pas, repli IP immédiat.
        if (err.code === 1) {
          stopWatch();
          applyIpFallback(
            "Accès à la position refusé — autorisez la localisation dans le navigateur (position estimée via IP)"
          );
        }
        // Codes 2/3 (indisponible / délai) : le suivi continue, une lecture
        // ultérieure peut aboutir. Le repli IP est géré par le minuteur.
      };

      // Suivi CONTINU : la position se met à jour à chaque déplacement,
      // le watch n'est arrêté qu'au démontage ou sur rafraîchissement manuel.
      watchId.current = navigator.geolocation.watchPosition(onReading, onFail, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: forceFresh ? 0 : 10000,
      });
      setTracking(true);

      // Si aucun point GPS après IP_FALLBACK_MS, estimer via IP en attendant
      // (le GPS surclassera automatiquement dès qu'un vrai point arrive).
      ipTimer.current = setTimeout(() => {
        if (!lastFix.current) applyIpFallback();
      }, IP_FALLBACK_MS);
    },
    [applyIpFallback, stopWatch]
  );

  useEffect(() => {
    startGps(false);
    return stopWatch;
  }, [startGps, stopWatch]);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    startGps(true);
  }, [startGps]);

  return { position, loading, error, tracking, refresh };
}
