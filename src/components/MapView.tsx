"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  Crosshair,
  Filter,
  Layers,
  Navigation,
  Radar,
  RadioTower,
  Ruler,
  Search,
  X,
} from "lucide-react";
import type { Antenna, AntennaStatus, ScanResult, Site } from "@/lib/types";
import { formatDistance, haversineDistance, statusColor, statusLabel } from "@/lib/utils";
import { DEFAULT_CENTER } from "@/lib/mapStyles";
import { MAP_DEFAULTS } from "@/lib/mapConfig";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useNearbyAntennas } from "@/hooks/useNearbyAntennas";

// Leaflet manipule directement le DOM : la carte ne doit pas être rendue
// côté serveur.
const MapInteractive = dynamic(() => import("./MapInteractive"), { ssr: false });

interface MapViewProps {
  sites: Site[];
  antennas: Antenna[];
  selectedAntennaId: string | null;
  onSelectAntenna: (id: string | null) => void;
  linkTxId?: string | null;
  linkRxId?: string | null;
  /** Derniers balayages radio remontés par les modules. */
  scans?: ScanResult[];
}


/** Bouton de bascule de la barre d'outils de la carte. */
function MapToggle({
  active,
  onClick,
  icon: Icon,
  label,
  title,
  activeClass,
  last = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label?: string;
  title: string;
  activeClass: string;
  last?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-xs font-semibold transition-colors sm:px-3 ${
        last ? "" : "border-r border-surface-overlay"
      } ${active ? activeClass : "text-ink-muted hover:bg-surface-overlay/50 hover:text-ink"}`}
    >
      <Icon className="h-4 w-4" />
      {label && <span>{label}</span>}
    </button>
  );
}

export default function MapView({
  sites,
  antennas,
  selectedAntennaId,
  onSelectAntenna,
  linkTxId = null,
  linkRxId = null,
  scans = [],
}: MapViewProps) {
  const {
    position: userPosition,
    loading: geoLoading,
    error: geoError,
    tracking,
    refresh,
  } = useGeolocation();
  /** Fond de carte : plan sombre ou vue satellite. */
  const [tileStyle, setTileStyle] = useState<"plan" | "satellite">("plan");

  const center = useMemo(() => userPosition ?? DEFAULT_CENTER, [userPosition]);

  // Les antennes sont affichées à leurs coordonnées réelles. Aucun
  // repositionnement artificiel : une antenne enregistrée à Lyon reste à
  // Lyon, même si vous consultez la carte depuis Abidjan.
  const mapSites = sites;
  const allMapAntennas = antennas;

  // Filtres d'affichage de la carte.
  const [statusFilter, setStatusFilter] = useState<"all" | AntennaStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | Antenna["type"]>("all");
  const [search, setSearch] = useState("");
  const [showCoverage, setShowCoverage] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  /** Antennes réelles des opérateurs (OpenStreetMap), activées par défaut. */
  const [showReal, setShowReal] = useState(true);
  // 5 km par défaut : au-delà, la requête OpenStreetMap dépasse souvent la
  // durée maximale d'une fonction serveur et bascule sur le navigateur.
  const [realRadius, setRealRadius] = useState(5000);
  /** Distances depuis la position et cercles de repère kilométriques. */
  const [showDistances, setShowDistances] = useState(true);

  const {
    antennas: realAntennas,
    loading: realLoading,
    error: realError,
  } = useNearbyAntennas(userPosition, realRadius, showReal);

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

  // Antennes triées de la plus proche à la plus éloignée de la position.
  const antennasByDistance = useMemo(() => {
    const withDistance = mapAntennas.map((a) => ({
      ...a,
      distance: userPosition
        ? haversineDistance(userPosition.lat, userPosition.lng, a.lat, a.lng)
        : null,
    }));
    if (!userPosition) return withDistance;
    return withDistance.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }, [mapAntennas, userPosition]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-surface-overlay shadow-card">
      {geoLoading ? (
        <div className="flex h-full items-center justify-center bg-surface-raised">
          <div className="flex items-center gap-2 text-ink-muted">
            <Navigation className="h-5 w-5 animate-spin" />
            Recherche de votre position...
          </div>
        </div>
      ) : (
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
          realAntennas={showReal ? realAntennas : []}
          scans={scans}
          tileStyle={tileStyle}
          showDistances={showDistances}
        />
      )}

      {/* Barre d'outils : les bascules d'affichage sont regroupées, les
          actions ponctuelles restent séparées. */}
      <div className="absolute right-2 top-2 z-20 flex flex-col items-end gap-2 sm:right-3 sm:top-3">
        <div className="panel flex max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl">
          <MapToggle
            active={filtersActive}
            onClick={() => setShowFilters((v) => !v)}
            icon={Filter}
            label={filtersActive ? `${mapAntennas.length}/${allMapAntennas.length}` : undefined}
            title="Filtrer les antennes"
            activeClass="bg-accent text-white"
          />
          <MapToggle
            active={showReal}
            onClick={() => setShowReal((v) => !v)}
            icon={RadioTower}
            label={showReal ? (realLoading ? "…" : String(realAntennas.length)) : undefined}
            title="Antennes des opérateurs (OpenStreetMap)"
            activeClass="bg-violet-600 text-white"
          />
          <MapToggle
            active={showDistances}
            onClick={() => setShowDistances((v) => !v)}
            icon={Ruler}
            title="Distances et repères kilométriques"
            activeClass="bg-blue-600 text-white"
          />
          <MapToggle
            active={showCoverage}
            onClick={() => setShowCoverage((v) => !v)}
            icon={Radar}
            title="Zones de couverture estimées"
            activeClass="bg-accent text-white"
          />
          <MapToggle
            active={tileStyle === "satellite"}
            onClick={() => setTileStyle(tileStyle === "plan" ? "satellite" : "plan")}
            icon={Layers}
            title={tileStyle === "plan" ? "Passer en satellite" : "Passer en plan"}
            activeClass="bg-ink text-white"
            last
          />
        </div>

        <button
          onClick={refresh}
          title="Recentrer sur ma position"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-card transition-colors hover:bg-blue-700"
        >
          <Crosshair className="h-5 w-5" />
        </button>
      </div>

      {/* Légende : posée en bas à gauche, le coin haut-gauche étant
          occupé par les commandes de zoom de Leaflet. */}
      <div className="panel absolute bottom-24 left-3 z-20 hidden rounded-xl px-3 py-2 lg:block">
        <ul className="space-y-1 text-[11px] text-ink-muted">
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
            Ma position
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            Mes antennes
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
            Antennes opérateurs
          </li>
        </ul>
      </div>

      {/* Panneau de filtres : ouvert sous la barre d'outils, à droite —
          les commandes de zoom de Leaflet occupent le coin haut-gauche. */}
      {showFilters && (
        <div className="panel absolute inset-x-3 top-16 z-30 rounded-xl p-3 sm:left-auto sm:right-3 sm:w-72">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">Filtrer les antennes</span>
            <button
              onClick={() => setShowFilters(false)}
              aria-label="Fermer les filtres"
              className="text-ink-muted hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom ou identifiant…"
              className="w-full rounded-lg border border-surface-overlay bg-surface-raised py-2 pl-8 pr-2 text-xs text-ink placeholder-ink-subtle outline-none focus:border-accent/50"
            />
          </div>

          <p className="mb-1 text-[11px] text-ink-muted">Statut</p>
          <div className="mb-2 flex flex-wrap gap-1">
            {(["all", "online", "warning", "offline", "idle"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-2.5 py-1 text-[11px] ${
                  statusFilter === s
                    ? "bg-accent text-white"
                    : "bg-surface-overlay text-ink-muted hover:bg-surface-overlay/70"
                }`}
              >
                {s === "all" ? "Tous" : statusLabel(s)}
              </button>
            ))}
          </div>

          <p className="mb-1 text-[11px] text-ink-muted">Type</p>
          <div className="flex flex-wrap gap-1">
            {(["all", "LoRa", "4G", "WiFi", "Satellite"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-full px-2.5 py-1 text-[11px] ${
                  typeFilter === t
                    ? "bg-accent text-white"
                    : "bg-surface-overlay text-ink-muted hover:bg-surface-overlay/70"
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
              className="mt-3 w-full rounded-lg bg-surface-overlay py-1.5 text-[11px] text-ink-muted hover:text-ink"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      <div className="absolute bottom-3 left-3 right-3 z-20">
        <div className="panel rounded-xl px-3 py-2 text-[11px] text-ink-muted sm:text-xs">
          {userPosition ? (
            <span>
              <span className="text-blue-600">●</span>{" "}
              <span className="font-mono text-ink">
                {userPosition.lat.toFixed(4)}, {userPosition.lng.toFixed(4)}
              </span>
              {" "}({userPosition.source === "gps" ? "GPS" : userPosition.source === "ip" ? "IP" : "défaut"}
              {userPosition.accuracy ? ` ±${Math.round(userPosition.accuracy)} m` : ""})
              {tracking && userPosition.source === "gps" && (
                <span className="ml-1.5 hidden text-status-online sm:inline">
                  ● suivi temps réel
                </span>
              )}
              {" · "}
              <span className="text-accent">{mapAntennas.length}</span> antennes
              {showReal && (
                <>
                  {" · "}
                  <span className="text-purple-400">
                    {realLoading ? "recherche…" : `${realAntennas.length} antennes réelles`}
                  </span>
                </>
              )}
            </span>
          ) : (
            <span>Position en cours...</span>
          )}
          {geoError && <span className="ml-2 text-status-warning">{geoError}</span>}
          {realError && <span className="ml-2 text-status-warning">{realError}</span>}
        </div>

        {selectedAntennaId &&
          (() => {
            const scan = scans.find((s) => s.antennaId === selectedAntennaId);
            if (!scan) return null;
            return (
              <div className="panel mt-2 hidden rounded-xl px-3 py-2 text-[11px] text-ink-muted sm:block">
                <span className="text-status-online">◎</span>{" "}
                <span className="text-ink">{scan.networks.length}</span> antennes captées
                par ce module — cercles = distance estimée depuis la puissance reçue
                {scan.networks[0] && (
                  <>
                    {" · plus fort : "}
                    <span className="font-mono text-ink">{scan.networks[0].ssid}</span>{" "}
                    ({scan.networks[0].rssi} dBm)
                  </>
                )}
              </div>
            );
          })()}

        {showReal && realAntennas.length > 0 && (
          <div className="panel mt-2 hidden rounded-xl px-3 py-2 text-[11px] text-ink-muted sm:block">
            <span className="text-violet-600">◆</span> Antennes des opérateurs
            (OpenStreetMap) — la plus proche à{" "}
            <span className="font-mono text-ink">
              {realAntennas[0].distanceMeters < 1000
                ? `${realAntennas[0].distanceMeters} m`
                : `${(realAntennas[0].distanceMeters / 1000).toFixed(1)} km`}
            </span>
            {realAntennas[0].operator ? ` · ${realAntennas[0].operator}` : ""}
            {" · rayon "}
            <select
              value={realRadius}
              onChange={(e) => setRealRadius(Number(e.target.value))}
              className="rounded bg-surface-overlay px-1 py-0.5 text-[11px] text-ink outline-none"
            >
              <option value={2000}>2 km</option>
              <option value={5000}>5 km</option>
              <option value={10000}>10 km</option>
              <option value={25000}>25 km</option>
            </select>
          </div>
        )}
        {mapAntennas.length > 0 && (
          <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
            {antennasByDistance.slice(0, 6).map((a) => (
              <button
                key={a.id}
                onClick={() => onSelectAntenna(a.id)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-mono transition ${
                  selectedAntennaId === a.id
                    ? "bg-accent text-white"
                    : "bg-white/95 text-ink ring-1 ring-surface-overlay hover:bg-white"
                }`}
                style={{ borderLeft: `3px solid ${statusColor(a.status)}` }}
              >
                {a.name}
                {a.distance !== null && (
                  <span className="ml-1.5 font-sans font-semibold text-blue-600">
                    {formatDistance(a.distance)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
