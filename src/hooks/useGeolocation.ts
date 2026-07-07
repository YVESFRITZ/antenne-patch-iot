"use client";

import { useCallback, useEffect, useState } from "react";

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy?: number;
  source: "gps" | "ip" | "default";
}

const DEFAULT_POSITION: GeoPosition = {
  lat: 5.3599,
  lng: -4.0083,
  source: "default",
};

async function fetchIpLocation(): Promise<GeoPosition | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.latitude && data.longitude) {
      return {
        lat: data.latitude,
        lng: data.longitude,
        accuracy: 5000,
        source: "ip",
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyFallback = useCallback(async () => {
    const ipPos = await fetchIpLocation();
    if (ipPos) {
      setPosition(ipPos);
      setError("Position estimée via IP (autorisez le GPS pour plus de précision)");
      setLoading(false);
      return;
    }
    setPosition(DEFAULT_POSITION);
    setError("Position par défaut (Abidjan) — autorisez la géolocalisation");
    setLoading(false);
  }, []);

  const onSuccess = useCallback((pos: GeolocationPosition) => {
    setPosition({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      source: "gps",
    });
    setLoading(false);
    setError(null);
  }, []);

  const onError = useCallback(
    async (err?: GeolocationPositionError) => {
      const messages: Record<number, string> = {
        1: "GPS refusé",
        2: "Position indisponible",
        3: "Délai dépassé",
      };
      if (err) {
        setError(messages[err.code] ?? "Erreur GPS");
      }
      await applyFallback();
    },
    [applyFallback]
  );

  useEffect(() => {
    if (!navigator.geolocation) {
      applyFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60000,
    });
  }, [onSuccess, onError, applyFallback]);

  const refresh = () => {
    setLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      applyFallback();
      return;
    }
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0,
    });
  };

  return { position, loading, error, refresh };
}
