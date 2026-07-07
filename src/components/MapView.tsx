"use client";

import { useMemo, useState } from "react";
import { Crosshair, Layers, MapPin, Navigation } from "lucide-react";
import type { Antenna, Site } from "@/lib/types";
import { statusColor, statusLabel } from "@/lib/utils";
import { DEFAULT_CENTER } from "@/lib/mapStyles";
import { GOOGLE_MAPS_CONFIG, MAP_DEFAULTS } from "@/lib/googleMapsConfig";
import { shiftSitesToUser } from "@/lib/geoShift";
import { useGeolocation } from "@/hooks/useGeolocation";
import GoogleMapsEmbed from "./GoogleMapsEmbed";
import MapInteractive from "./MapInteractive";
import OsmEmbed from "./OsmEmbed";

interface MapViewProps {
  sites: Site[];
  antennas: Antenna[];
  selectedAntennaId: string | null;
  onSelectAntenna: (id: string | null) => void;
}

const MAP_HEIGHT = MAP_DEFAULTS.minHeight;

export default function MapView({
  sites,
  antennas,
  selectedAntennaId,
  onSelectAntenna,
}: MapViewProps) {
  const apiKey = GOOGLE_MAPS_CONFIG.apiKey;
  const { position: userPosition, loading: geoLoading, error: geoError, refresh } = useGeolocation();
  const [mode, setMode] = useState<"google" | "osm" | "interactive">("osm");

  const center = useMemo(() => userPosition ?? DEFAULT_CENTER, [userPosition]);

  const { sites: mapSites, antennas: mapAntennas } = useMemo(() => {
    if (!userPosition) return { sites, antennas };
    return shiftSitesToUser(sites, antennas, userPosition.lat, userPosition.lng);
  }, [sites, antennas, userPosition]);

  if (!apiKey) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-surface-overlay bg-surface-raised p-6 text-center"
        style={{ height: MAP_HEIGHT }}
      >
        <MapPin className="mb-3 h-10 w-10 text-accent" />
        <p className="text-sm font-medium text-white">Clé Google Maps manquante</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-surface-overlay" style={{ height: MAP_HEIGHT }}>
      {geoLoading ? (
        <div className="flex h-full items-center justify-center bg-surface-raised">
          <div className="flex items-center gap-2 text-slate-400">
            <Navigation className="h-5 w-5 animate-spin" />
            Recherche de votre position...
          </div>
        </div>
      ) : mode === "google" ? (
        <MapInteractive
          center={center}
          userPosition={userPosition}
          sites={mapSites}
          antennas={mapAntennas}
          selectedAntennaId={selectedAntennaId}
          onSelectAntenna={onSelectAntenna}
          onFallback={() => setMode("osm")}
        />
      ) : mode === "osm" ? (
        <OsmEmbed lat={center.lat} lng={center.lng} zoom={MAP_DEFAULTS.zoom} />
      ) : (
        <GoogleMapsEmbed lat={center.lat} lng={center.lng} zoom={MAP_DEFAULTS.zoom} />
      )}

      <div className="absolute right-3 top-3 z-20 flex gap-2">
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2 text-xs font-medium text-white shadow-lg hover:bg-blue-600"
        >
          <Crosshair className="h-4 w-4" />
          GPS
        </button>
        <button
          onClick={() => {
            const next = mode === "google" ? "osm" : mode === "osm" ? "interactive" : "google";
            setMode(next);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-surface-overlay/90 px-3 py-2 text-xs font-medium text-white shadow-lg hover:bg-surface-overlay"
        >
          <Layers className="h-4 w-4" />
          {mode === "google" ? "Google Maps" : mode === "osm" ? "OpenStreetMap" : "Embed"}
        </button>
      </div>

      <div className="absolute bottom-3 left-3 right-3 z-20">
        <div className="glass rounded-lg px-3 py-2 text-xs text-slate-300">
          {userPosition ? (
            <span>
              <span className="text-blue-400">●</span>{" "}
              <span className="font-mono text-white">
                {userPosition.lat.toFixed(4)}, {userPosition.lng.toFixed(4)}
              </span>
              {" "}({userPosition.source === "gps" ? "GPS" : userPosition.source === "ip" ? "IP" : "défaut"})
              {" · "}{mapAntennas.length} antennes
            </span>
          ) : (
            <span>Position en cours...</span>
          )}
          {geoError && <span className="ml-2 text-status-warning">{geoError}</span>}
        </div>
        {mapAntennas.length > 0 && (
          <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
            {mapAntennas.slice(0, 6).map((a) => (
              <button
                key={a.id}
                onClick={() => onSelectAntenna(a.id)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-mono transition ${
                  selectedAntennaId === a.id
                    ? "bg-accent text-black"
                    : "bg-surface-overlay text-slate-300 hover:bg-surface-overlay/80"
                }`}
                style={{ borderLeft: `3px solid ${statusColor(a.status)}` }}
              >
                {a.name} · {statusLabel(a.status)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
