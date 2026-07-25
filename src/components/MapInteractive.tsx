"use client";

import { useEffect, useState } from "react";
import { APIProvider, Map, Marker, InfoWindow, useMap } from "@vis.gl/react-google-maps";
import type { Antenna, Site } from "@/lib/types";
import type { NearbyAntenna } from "@/lib/nearbyAntennas";
import {
  coverageRadiusMeters,
  formatDistance,
  haversineDistance,
  statusColor,
  statusLabel,
} from "@/lib/utils";
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
  linkTxId?: string | null;
  linkRxId?: string | null;
  showCoverage?: boolean;
  /** Antennes réelles des opérateurs (OpenStreetMap). */
  realAntennas?: NearbyAntenna[];
  onFallback: () => void;
}

/** Cercles de couverture estimée autour de chaque antenne. */
function CoverageLayer({ antennas }: { antennas: Antenna[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === "undefined") return;

    const circles = antennas
      .map((antenna) => {
        const radius = coverageRadiusMeters(antenna.type, antenna.signalStrength);
        if (radius <= 0) return null;
        const color = statusColor(antenna.status);
        return new google.maps.Circle({
          center: { lat: antenna.lat, lng: antenna.lng },
          radius,
          strokeColor: color,
          strokeOpacity: 0.5,
          strokeWeight: 1,
          fillColor: color,
          fillOpacity: 0.08,
          clickable: false,
          map,
          zIndex: 10,
        });
      })
      .filter((c): c is google.maps.Circle => c !== null);

    return () => circles.forEach((c) => c.setMap(null));
  }, [map, antennas]);

  return null;
}

/** Trace la liaison émetteur → récepteur (polyligne + flèche animée). */
function LinkLine({ tx, rx }: { tx: Antenna; rx: Antenna }) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === "undefined") return;
    const line = new google.maps.Polyline({
      path: [
        { lat: tx.lat, lng: tx.lng },
        { lat: rx.lat, lng: rx.lng },
      ],
      geodesic: true,
      strokeColor: "#00d4aa",
      strokeOpacity: 0.9,
      strokeWeight: 3,
      icons: [
        {
          icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3 },
          offset: "100%",
        },
      ],
      map,
      zIndex: 50,
    });
    return () => line.setMap(null);
  }, [map, tx.lat, tx.lng, rx.lat, rx.lng]);

  return null;
}

export default function MapInteractive({
  center,
  userPosition,
  sites,
  antennas,
  selectedAntennaId,
  onSelectAntenna,
  linkTxId = null,
  linkRxId = null,
  showCoverage = false,
  realAntennas = [],
  onFallback,
}: MapInteractiveProps) {
  const [infoId, setInfoId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const linkTx = antennas.find((a) => a.id === linkTxId) ?? null;
  const linkRx = antennas.find((a) => a.id === linkRxId) ?? null;
  const hasLink = linkTx && linkRx && linkTx.id !== linkRx.id;
  const linkMidpoint = hasLink
    ? { lat: (linkTx!.lat + linkRx!.lat) / 2, lng: (linkTx!.lng + linkRx!.lng) / 2 }
    : null;
  const linkDistance = hasLink
    ? haversineDistance(linkTx!.lat, linkTx!.lng, linkRx!.lat, linkRx!.lng)
    : 0;

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

        {showCoverage && <CoverageLayer antennas={antennas} />}

        {/* Antennes reelles des operateurs : marqueurs violets, non supervisees */}
        {realAntennas.map((real) => (
          <Marker
            key={real.id}
            position={{ lat: real.lat, lng: real.lng }}
            title={real.name ?? real.operator ?? "Antenne opérateur"}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: "#a855f7",
              fillOpacity: 0.9,
              strokeColor: "#ffffff",
              strokeWeight: 1.5,
            }}
            onClick={() => setInfoId(`real-${real.id}`)}
          />
        ))}

        {infoId?.startsWith("real-") && (() => {
          const real = realAntennas.find((r) => `real-${r.id}` === infoId);
          if (!real) return null;
          return (
            <InfoWindow
              position={{ lat: real.lat, lng: real.lng }}
              onCloseClick={() => setInfoId(null)}
            >
              <div style={{ color: "#1a2332", fontSize: 13, maxWidth: 220 }}>
                <strong>{real.name ?? real.operator ?? "Antenne opérateur"}</strong>
                <p style={{ margin: "4px 0" }}>
                  {real.kind === "communications_tower"
                    ? "Tour de télécommunication"
                    : real.kind === "mast"
                      ? "Pylône / mât"
                      : "Pylône"}
                  {real.towerType ? ` (${real.towerType})` : ""}
                </p>
                {real.operator && <p style={{ margin: "2px 0" }}>Opérateur : {real.operator}</p>}
                <p style={{ margin: "2px 0" }}>
                  Distance :{" "}
                  {real.distanceMeters < 1000
                    ? `${real.distanceMeters} m`
                    : `${(real.distanceMeters / 1000).toFixed(2)} km`}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>
                  Source : OpenStreetMap — antenne non supervisée
                </p>
              </div>
            </InfoWindow>
          );
        })()}

        {hasLink && <LinkLine tx={linkTx!} rx={linkRx!} />}

        {hasLink && linkMidpoint && (
          <InfoWindow position={linkMidpoint}>
            <div style={{ color: "#0a0e14", fontSize: 12, fontWeight: 700 }}>
              📡 {linkTx!.name} → {linkRx!.name}
              <div style={{ color: "#0a8f76", fontWeight: 700 }}>
                {formatDistance(linkDistance)}
              </div>
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
