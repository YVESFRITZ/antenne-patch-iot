"use client";

import { useEffect, useState } from "react";
import { APIProvider, Map, Marker, InfoWindow } from "@vis.gl/react-google-maps";
import type { Antenna, Site } from "@/lib/types";
import { statusColor, statusLabel } from "@/lib/utils";
import { darkMapStyle } from "@/lib/mapStyles";
import { GOOGLE_MAPS_CONFIG, MAP_DEFAULTS } from "@/lib/googleMapsConfig";
import type { GeoPosition } from "@/hooks/useGeolocation";

interface MapInteractiveProps {
  center: { lat: number; lng: number };
  userPosition: GeoPosition | null;
  sites: Site[];
  antennas: Antenna[];
  selectedAntennaId: string | null;
  onSelectAntenna: (id: string | null) => void;
  onFallback: () => void;
}

export default function MapInteractive({
  center,
  userPosition,
  sites,
  antennas,
  selectedAntennaId,
  onSelectAntenna,
  onFallback,
}: MapInteractiveProps) {
  const [infoId, setInfoId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!mapReady) onFallback();
    }, 10000);
    return () => clearTimeout(timer);
  }, [mapReady, onFallback]);

  return (
    <APIProvider apiKey={GOOGLE_MAPS_CONFIG.apiKey} language="fr" region="FR">
      <Map
        defaultCenter={center}
        defaultZoom={MAP_DEFAULTS.zoom}
        center={center}
        zoom={MAP_DEFAULTS.zoom}
        gestureHandling="greedy"
        styles={darkMapStyle}
        style={{ width: "100%", height: MAP_DEFAULTS.minHeight }}
        onTilesLoaded={() => setMapReady(true)}
      >
        {userPosition && (
          <Marker
            position={userPosition}
            title="Ma position"
            onClick={() => setInfoId("user")}
          />
        )}

        {sites.map((site) => (
          <Marker
            key={site.id}
            position={{ lat: site.lat, lng: site.lng }}
            title={site.name}
            onClick={() => setInfoId(`site-${site.id}`)}
          />
        ))}

        {antennas.map((antenna) => (
          <Marker
            key={antenna.id}
            position={{ lat: antenna.lat, lng: antenna.lng }}
            title={antenna.name}
            onClick={() => {
              onSelectAntenna(antenna.id);
              setInfoId(`ant-${antenna.id}`);
            }}
          />
        ))}

        {infoId === "user" && userPosition && (
          <InfoWindow position={userPosition} onCloseClick={() => setInfoId(null)}>
            <div style={{ color: "#1a2332", fontSize: 13 }}>
              <strong>Ma position</strong>
              <p>{userPosition.lat.toFixed(5)}, {userPosition.lng.toFixed(5)}</p>
            </div>
          </InfoWindow>
        )}

        {infoId?.startsWith("ant-") && (() => {
          const ant = antennas.find((a) => `ant-${a.id}` === infoId);
          if (!ant) return null;
          return (
            <InfoWindow position={{ lat: ant.lat, lng: ant.lng }} onCloseClick={() => setInfoId(null)}>
              <div style={{ color: "#1a2332", fontSize: 13 }}>
                <strong>{ant.name}</strong>
                <p style={{ color: statusColor(ant.status) }}>{statusLabel(ant.status)}</p>
              </div>
            </InfoWindow>
          );
        })()}
      </Map>
    </APIProvider>
  );
}
