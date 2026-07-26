"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Antenna, ScanResult, Site } from "@/lib/types";
import type { NearbyAntenna } from "@/lib/nearbyAntennas";
import { estimateDistanceFromRssi } from "@/lib/serialParse";
import {
  coverageRadiusMeters,
  formatDistance,
  haversineDistance,
  statusColor,
  statusLabel,
} from "@/lib/utils";
import { MAP_DEFAULTS } from "@/lib/mapConfig";
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
  /** Derniers balayages radio remontés par les modules. */
  scans?: ScanResult[];
  /** Fond de carte : plan ou vue satellite. */
  tileStyle?: "plan" | "satellite";
}

/** Fonds de carte libres, sans clé d'API ni facturation. */
const TILE_LAYERS = {
  plan: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagerie &copy; Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  },
};

/** Glyphes des marqueurs, tracés en SVG pour rester nets à tout zoom. */
const GLYPHS = {
  // Antenne émettrice : mât et ondes.
  antenna:
    '<path d="M12 8.5v7M9.2 6.4a4 4 0 0 1 5.6 0M6.6 3.9a7.6 7.6 0 0 1 10.8 0" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>',
  // Site : bâtiment.
  site: '<path d="M7 16V9l5-3 5 3v7" fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/><path d="M10.5 16v-3h3v3" fill="none" stroke="#fff" stroke-width="1.5"/>',
  // Pylône d'opérateur : treillis.
  tower:
    '<path d="M9 17l3-11 3 11M9.8 13h4.4M8.9 10.5h6.2" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
};

/**
 * Épingle SVG avec glyphe. Le tracé est dessiné une fois en chaîne, ce
 * qui évite de créer des éléments DOM lourds pour chaque marqueur.
 */
function pinIcon(color: string, glyph: keyof typeof GLYPHS, selected = false): L.DivIcon {
  const w = selected ? 40 : 32;
  const h = selected ? 52 : 42;
  const svg = `
<svg width="${w}" height="${h}" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="s" x="-50%" y="-30%" width="200%" height="180%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" flood-color="#0f172a" flood-opacity="0.35"/>
    </filter>
  </defs>
  <path filter="url(#s)"
        d="M12 31.2C12 31.2 22.4 19.6 22.4 12.4A10.4 10.4 0 1 0 1.6 12.4C1.6 19.6 12 31.2 12 31.2Z"
        fill="${color}" stroke="#ffffff" stroke-width="1.6"/>
  ${GLYPHS[glyph]}
</svg>`;
  return L.divIcon({
    className: selected ? "marker-pulse" : "",
    html: svg,
    iconSize: [w, h],
    // La pointe de l'épingle doit toucher la coordonnée exacte.
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 8],
  });
}

/** Point simple, pour la position de l'utilisateur. */
function userIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="
      display:block;width:16px;height:16px;border-radius:9999px;
      background:#2563eb;border:3px solid #ffffff;
      box-shadow:0 0 0 5px rgba(37,99,235,.20), 0 2px 6px rgba(15,23,42,.35);
    "></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
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
  scans = [],
  tileStyle = "plan",
}: MapInteractiveProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  /** Couche unique regroupant tout ce qui est redessiné à chaque mise à jour. */
  const layerRef = useRef<L.LayerGroup | null>(null);
  /** Évite de recentrer la carte en continu pendant le suivi GPS. */
  const centeredRef = useRef<{ lat: number; lng: number } | null>(null);

  // Création de la carte (une seule fois).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: MAP_DEFAULTS.zoom,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    centeredRef.current = center;

    // Leaflet mémorise la taille du conteneur à l'initialisation. Sans ce
    // recalcul, changer d'onglet, tourner l'écran ou replier la barre
    // latérale laisse des tuiles décalées ou des zones grises.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    // Premier recalcul après la mise en page initiale.
    const initial = setTimeout(() => map.invalidateSize(), 200);

    return () => {
      observer.disconnect();
      clearTimeout(initial);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // Le centre initial ne doit pas recréer la carte : dépendances vides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fond de carte.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    tileRef.current?.remove();
    const conf = TILE_LAYERS[tileStyle];
    tileRef.current = L.tileLayer(conf.url, {
      attribution: conf.attribution,
      maxZoom: conf.maxZoom,
    }).addTo(map);
  }, [tileStyle]);

  // Recentrage : uniquement sur un déplacement réel, pour ne pas
  // reprendre la main pendant que l'utilisateur explore la carte.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const previous = centeredRef.current;
    if (
      !previous ||
      haversineDistance(previous.lat, previous.lng, center.lat, center.lng) > 300
    ) {
      map.setView([center.lat, center.lng], map.getZoom());
      centeredRef.current = center;
    }
  }, [center]);

  // Toutes les couches de données, redessinées ensemble.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    // -- Position de l'utilisateur --
    if (userPosition) {
      L.marker([userPosition.lat, userPosition.lng], {
        icon: userIcon(),
        title: "Ma position",
        zIndexOffset: 800,
      })
        .bindPopup(
          `<strong>Ma position</strong><br/>${userPosition.lat.toFixed(5)}, ${userPosition.lng.toFixed(5)}` +
            (userPosition.accuracy ? `<br/>précision ±${Math.round(userPosition.accuracy)} m` : "")
        )
        .addTo(layer);

      if (userPosition.accuracy) {
        L.circle([userPosition.lat, userPosition.lng], {
          radius: userPosition.accuracy,
          color: "#3b82f6",
          weight: 1,
          opacity: 0.5,
          fillOpacity: 0.08,
        }).addTo(layer);
      }
    }

    // -- Sites --
    for (const site of sites) {
      L.marker([site.lat, site.lng], {
        icon: pinIcon(statusColor(site.status), "site"),
        title: site.name,
        zIndexOffset: 200,
      })
        .bindPopup(
          `<strong>${site.name}</strong><br/>${site.address || ""}<br/>` +
            `<span style="color:${statusColor(site.status)}">${statusLabel(site.status)}</span>`
        )
        .addTo(layer);
    }

    // -- Zones de couverture estimées --
    if (showCoverage) {
      for (const antenna of antennas) {
        const radius = coverageRadiusMeters(antenna.type, antenna.signalStrength);
        if (radius <= 0) continue;
        L.circle([antenna.lat, antenna.lng], {
          radius,
          color: statusColor(antenna.status),
          weight: 1,
          opacity: 0.5,
          fillOpacity: 0.07,
        }).addTo(layer);
      }
    }

    // -- Antennes captées par le module sélectionné --
    const scan = selectedAntennaId
      ? scans.find((s) => s.antennaId === selectedAntennaId)
      : undefined;
    const scanned = selectedAntennaId
      ? antennas.find((a) => a.id === selectedAntennaId)
      : undefined;
    if (scan && scanned) {
      // Un anneau par émetteur : le module mesure une distance, pas une
      // direction — l'émetteur est quelque part sur ce cercle.
      for (const net of scan.networks.slice(0, 5)) {
        const radius = Math.max(15, estimateDistanceFromRssi(net.rssi));
        const color = net.rssi >= -60 ? "#22c55e" : net.rssi >= -75 ? "#f59e0b" : "#ef4444";
        L.circle([scanned.lat, scanned.lng], {
          radius,
          color,
          weight: 1.5,
          opacity: 0.7,
          fill: false,
        })
          .bindPopup(
            `<strong>${net.ssid}</strong><br/>${net.rssi} dBm — ~${formatDistance(radius)}` +
              (net.channel ? `<br/>canal ${net.channel}` : "") +
              (net.encryption ? ` · ${net.encryption}` : "")
          )
          .addTo(layer);
      }
    }

    // -- Antennes réelles des opérateurs (OpenStreetMap) --
    for (const real of realAntennas) {
      L.marker([real.lat, real.lng], {
        icon: pinIcon("#8b5cf6", "tower"),
        title: real.name ?? real.operator ?? "Antenne opérateur",
        zIndexOffset: 100,
      })
        .bindPopup(
          `<strong>${real.name ?? real.operator ?? "Antenne opérateur"}</strong><br/>` +
            (real.kind === "communications_tower"
              ? "Tour de télécommunication"
              : real.kind === "mast"
                ? "Pylône / mât"
                : "Pylône") +
            (real.operator ? `<br/>Opérateur : ${real.operator}` : "") +
            `<br/>Distance : ${formatDistance(real.distanceMeters)}` +
            `<br/><em style="color:#64748b">Source : OpenStreetMap — non supervisée</em>`
        )
        .addTo(layer);
    }

    // -- Mes antennes --
    for (const antenna of antennas) {
      const selected = antenna.id === selectedAntennaId;
      L.marker([antenna.lat, antenna.lng], {
        icon: pinIcon(statusColor(antenna.status), "antenna", selected),
        title: antenna.name,
        zIndexOffset: selected ? 700 : 500,
      })
        .on("click", () => onSelectAntenna(antenna.id))
        .bindPopup(
          `<strong>${antenna.name}</strong><br/>${antenna.type} · ` +
            `<span style="color:${statusColor(antenna.status)}">${statusLabel(antenna.status)}</span>` +
            `<br/>Signal ${antenna.signalStrength}% · Batterie ${Math.round(antenna.battery)}%`
        )
        .addTo(layer);
    }

    // -- Liaison émetteur → récepteur --
    const tx = antennas.find((a) => a.id === linkTxId);
    const rx = antennas.find((a) => a.id === linkRxId);
    if (tx && rx && tx.id !== rx.id) {
      L.polyline(
        [
          [tx.lat, tx.lng],
          [rx.lat, rx.lng],
        ],
        { color: "#0d9488", weight: 3, opacity: 0.9 }
      )
        .bindPopup(
          `<strong>${tx.name} → ${rx.name}</strong><br/>` +
            formatDistance(haversineDistance(tx.lat, tx.lng, rx.lat, rx.lng))
        )
        .addTo(layer);
    }
  }, [
    userPosition,
    sites,
    antennas,
    realAntennas,
    scans,
    selectedAntennaId,
    linkTxId,
    linkRxId,
    showCoverage,
    onSelectAntenna,
  ]);

  return (
    // La carte remplit son conteneur : c'est le parent qui fixe la hauteur.
    <div ref={containerRef} className="h-full w-full" style={{ background: "#eef2f7" }} />
  );
}
