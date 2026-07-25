"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Filter, Layers, MapPin, Navigation, Radar, Search, X } from "lucide-react";
import { haversineDistance } from "@/lib/utils";
import type { Antenna, AntennaStatus, Site } from "@/lib/types";
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
  linkTxId?: string | null;
  linkRxId?: string | null;
}

const MAP_HEIGHT = MAP_DEFAULTS.minHeight;

export default function MapView({
  sites,
  antennas,
  selectedAntennaId,
  onSelectAntenna,
  linkTxId = null,
  linkRxId = null,
}: MapViewProps) {
  const apiKey = GOOGLE_MAPS_CONFIG.apiKey;
  const {
    position: userPosition,
    loading: geoLoading,
    error: geoError,
    tracking,
    refresh,
  } = useGeolocation();
  const [mode, setMode] = useState<"google" | "osm" | "interactive">("osm");

  const center = useMemo(() => userPosition ?? DEFAULT_CENTER, [userPosition]);

  // Les cartes en iframe (OSM / Embed) rechargent la page à chaque changement
  // de coordonnées : on ne les recentre qu'au-delà d'un vrai déplacement,
  // sinon le suivi temps réel ferait clignoter la carte en permanence.
  const embedCenterRef = useRef(center);
  const lastEmbed = embedCenterRef.current;
  if (haversineDistance(lastEmbed.lat, lastEmbed.lng, center.lat, center.lng) > 150) {
    embedCenterRef.current = center;
  }
  const embedCenter = embedCenterRef.current;

  // Le tracé de liaison n'est visible que sur la carte Google interactive :
  // on bascule automatiquement quand une liaison TX→RX est sélectionnée.
  useEffect(() => {
    if (linkTxId && linkRxId) setMode("google");
  }, [linkTxId, linkRxId]);

  const { sites: mapSites, antennas: allMapAntennas } = useMemo(() => {
    if (!userPosition) return { sites, antennas };
    return shiftSitesToUser(sites, antennas, userPosition.lat, userPosition.lng);
  }, [sites, antennas, userPosition]);

  // Filtres d'affichage de la carte.
  const [statusFilter, setStatusFilter] = useState<"all" | AntennaStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | Antenna["type"]>("all");
  const [search, setSearch] = useState("");
  const [showCoverage, setShowCoverage] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const mapAntennas = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allMapAntennas.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (term && !a.name.toLowerCase().includes(term) && !a.id.toLowerCase().includes(term))
        return false;
      return true;
    });
  }, [allMapAntennas, statusFilter, typeFilter, search]);

  const filtersActive =
    statusFilter !== "all" || typeFilter !== "all" || search.trim().length > 0;

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
          linkTxId={linkTxId}
          linkRxId={linkRxId}
          showCoverage={showCoverage}
          onFallback={() => setMode("osm")}
        />
      ) : mode === "osm" ? (
        <OsmEmbed lat={embedCenter.lat} lng={embedCenter.lng} zoom={MAP_DEFAULTS.zoom} />
      ) : (
        <GoogleMapsEmbed lat={embedCenter.lat} lng={embedCenter.lng} zoom={MAP_DEFAULTS.zoom} />
      )}

      <div className="absolute right-3 top-3 z-20 flex flex-wrap justify-end gap-2">
        <button
          onClick={() => setShowFilters((v) => !v)}
          aria-label="Filtres"
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium shadow-lg ${
            filtersActive
              ? "bg-accent text-black"
              : "bg-surface-overlay/90 text-white hover:bg-surface-overlay"
          }`}
        >
          <Filter className="h-4 w-4" />
          {filtersActive ? `${mapAntennas.length}/${allMapAntennas.length}` : "Filtres"}
        </button>
        <button
          onClick={() => setShowCoverage((v) => !v)}
          aria-label="Zones de couverture"
          title="Zones de couverture"
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium shadow-lg ${
            showCoverage
              ? "bg-accent text-black"
              : "bg-surface-overlay/90 text-white hover:bg-surface-overlay"
          }`}
        >
          <Radar className="h-4 w-4" />
        </button>
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

      {showFilters && (
        <div className="glass absolute left-3 right-3 top-3 z-30 rounded-xl p-3 sm:right-auto sm:w-72">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-white">Filtrer les antennes</span>
            <button
              onClick={() => setShowFilters(false)}
              aria-label="Fermer les filtres"
              className="text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom ou identifiant…"
              className="w-full rounded-lg border border-surface-overlay bg-surface-raised py-2 pl-8 pr-2 text-xs text-white placeholder-slate-500 outline-none focus:border-accent/50"
            />
          </div>

          <p className="mb-1 text-[11px] text-slate-400">Statut</p>
          <div className="mb-2 flex flex-wrap gap-1">
            {(["all", "online", "warning", "offline", "idle"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-2.5 py-1 text-[11px] ${
                  statusFilter === s
                    ? "bg-accent text-black"
                    : "bg-surface-overlay text-slate-300 hover:bg-surface-overlay/70"
                }`}
              >
                {s === "all" ? "Tous" : statusLabel(s)}
              </button>
            ))}
          </div>

          <p className="mb-1 text-[11px] text-slate-400">Type</p>
          <div className="flex flex-wrap gap-1">
            {(["all", "LoRa", "4G", "WiFi", "Satellite"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-full px-2.5 py-1 text-[11px] ${
                  typeFilter === t
                    ? "bg-accent text-black"
                    : "bg-surface-overlay text-slate-300 hover:bg-surface-overlay/70"
                }`}
              >
                {t === "all" ? "Tous" : t}
              </button>
            ))}
          </div>

          {filtersActive && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setTypeFilter("all");
                setSearch("");
              }}
              className="mt-3 w-full rounded-lg bg-surface-overlay py-1.5 text-[11px] text-slate-300 hover:text-white"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      <div className="absolute bottom-3 left-3 right-3 z-20">
        <div className="glass rounded-lg px-3 py-2 text-xs text-slate-300">
          {userPosition ? (
            <span>
              <span className="text-blue-400">●</span>{" "}
              <span className="font-mono text-white">
                {userPosition.lat.toFixed(4)}, {userPosition.lng.toFixed(4)}
              </span>
              {" "}({userPosition.source === "gps" ? "GPS" : userPosition.source === "ip" ? "IP" : "défaut"}
              {userPosition.accuracy ? ` ±${Math.round(userPosition.accuracy)} m` : ""})
              {tracking && userPosition.source === "gps" && (
                <span className="ml-1.5 text-status-online">● suivi temps réel</span>
              )}
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
