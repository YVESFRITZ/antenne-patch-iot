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
  /** Affiche les distances depuis la position et les cercles de repère. */
  showDistances?: boolean;
}

/** Cercles de repère kilométriques tracés autour de la position. */
const DISTANCE_RINGS = [1000, 5000, 10000, 25000];

/** Étiquette de distance attachée à un marqueur. */
function distanceLabel(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
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

/**
 * Glyphes dessinés dans un repère 24×24, centré sur (12,12).
 * Ils sont ensuite replacés dans la tête de l'épingle par une
 * transformation, ce qui garantit un centrage correct quelle que soit
 * la taille du marqueur.
 */
const GLYPHS = {
  // Antenne émettrice : mât et ondes de part et d'autre.
  antenna:
    '<path d="M12 10v9M8.5 8.5a5 5 0 0 1 7 0M5.5 5.5a9 9 0 0 1 13 0" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
  // Site : bâtiment avec toit.
  site:
    '<path d="M5 19V10l7-4.5 7 4.5v9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M10 19v-4.5h4V19" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
  // Pylône d'opérateur : mât en treillis.
  tower:
    '<path d="M7.5 20l4.5-15 4.5 15M9 15h6M8 11.5h8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
};

/**
 * Épingle SVG avec glyphe centré dans sa tête.
 *
 * Le repère est 32×42 : tête circulaire de rayon 13 centrée en (16,16),
 * pointe à (16,41). Le glyphe 24×24 est ramené à l'échelle 0,72 puis
 * centré sur la tête.
 */
function pinIcon(color: string, glyph: keyof typeof GLYPHS, selected = false): L.DivIcon {
  const scale = selected ? 1.25 : 1;
  const w = Math.round(32 * scale);
  const h = Math.round(42 * scale);
  const g = 0.72; // échelle du glyphe
  const offset = 16 - 12 * g; // recentre le repère 24×24 sur (16,16)

  const svg = `
<svg width="${w}" height="${h}" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 41C16 41 29 25.5 29 16A13 13 0 1 0 3 16C3 25.5 16 41 16 41Z"
        fill="rgba(15,23,42,.22)" transform="translate(0,1.5)"/>
  <path d="M16 41C16 41 29 25.5 29 16A13 13 0 1 0 3 16C3 25.5 16 41 16 41Z"
        fill="${color}" stroke="#ffffff" stroke-width="2"/>
  <g transform="translate(${offset},${offset}) scale(${g})">${GLYPHS[glyph]}</g>
</svg>`;

  return L.divIcon({
    className: selected ? "marker-pulse" : "",
    html: svg,
    iconSize: [w, h],
    // La pointe de l'épingle touche la coordonnée exacte.
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 10],
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
  showDistances = true,
}: MapInteractiveProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  /** Antennes, sites, couverture, liaison : redessinés quand les données changent. */
  const layerRef = useRef<L.LayerGroup | null>(null);
  /** Position et repères kilométriques : suivent le GPS, séparément. */
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  /** Évite de recentrer la carte en continu pendant le suivi GPS. */
  const centeredRef = useRef<{ lat: number; lng: number } | null>(null);
  /**
   * Position figée servant au calcul des distances affichées sur les
   * marqueurs. Elle ne bouge qu'au-delà de 50 m : sans cela, la moindre
   * dérive GPS ferait redessiner toutes les antennes.
   */
  const anchorRef = useRef<{ lat: number; lng: number } | null>(null);
  if (userPosition) {
    const previous = anchorRef.current;
    if (
      !previous ||
      haversineDistance(previous.lat, previous.lng, userPosition.lat, userPosition.lng) > 50
    ) {
      anchorRef.current = { lat: userPosition.lat, lng: userPosition.lng };
    }
  }
  const anchorLat = anchorRef.current?.lat ?? null;
  const anchorLng = anchorRef.current?.lng ?? null;

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
    userLayerRef.current = L.layerGroup().addTo(map);
    centeredRef.current = center;

    // Leaflet fige la taille du conteneur à l'initialisation et ne charge
    // les tuiles que pour cette zone. Si la mise en page s'ajuste ensuite
    // (arrivée des données, barre latérale, rotation de l'écran), les
    // tuiles ne couvrent qu'une bande et le reste apparaît blanc.
    const refresh = () => map.invalidateSize({ animate: false });

    const observer = new ResizeObserver(refresh);
    observer.observe(containerRef.current);
    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);

    // La mise en page se stabilise en plusieurs étapes : on repasse
    // plusieurs fois plutôt que de parier sur un seul instant.
    const timers = [0, 150, 400, 900, 1600].map((delay) =>
      setTimeout(refresh, delay)
    );

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
      timers.forEach(clearTimeout);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      userLayerRef.current = null;
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
      // Charge une couronne de tuiles au-delà du cadre visible : évite
      // les bords blancs pendant les déplacements.
      keepBuffer: 3,
    }).addTo(map);
    // La couche vient d'être posée : s'assurer qu'elle couvre bien tout.
    map.invalidateSize({ animate: false });
  }, [tileStyle]);

  // Recentrage : uniquement sur un déplacement franc, et en glissant
  // doucement. Reprendre la vue à chaque lecture GPS empêcherait
  // l'utilisateur d'explorer la carte.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const previous = centeredRef.current;
    if (
      !previous ||
      haversineDistance(previous.lat, previous.lng, center.lat, center.lng) > 500
    ) {
      map.panTo([center.lat, center.lng], { animate: true, duration: 0.6 });
      centeredRef.current = { lat: center.lat, lng: center.lng };
    }
  }, [center]);

  /**
   * Position et repères kilométriques, dans leur propre couche.
   *
   * Isoler ce bloc évite de redessiner les dizaines de marqueurs
   * d'antennes à chaque lecture GPS : c'est ce qui faisait clignoter la
   * carte pendant le suivi.
   */
  useEffect(() => {
    const layer = userLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!userPosition) return;

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
        color: "#2563eb",
        weight: 1,
        opacity: 0.45,
        fillOpacity: 0.07,
        interactive: false,
      }).addTo(layer);
    }

    // Cercles de repère : donnent l'échelle des distances d'un coup d'œil.
    if (showDistances) {
      for (const radius of DISTANCE_RINGS) {
        L.circle([userPosition.lat, userPosition.lng], {
          radius,
          color: "#2563eb",
          weight: 1,
          opacity: 0.25,
          dashArray: "5 7",
          fill: false,
          interactive: false,
        }).addTo(layer);

        // Étiquette posée au nord du cercle (1° de latitude ≈ 111,32 km).
        L.marker([userPosition.lat + radius / 111320, userPosition.lng], {
          icon: L.divIcon({
            className: "",
            html: `<span style="
              display:inline-block;padding:1px 6px;border-radius:9999px;
              background:rgba(37,99,235,.10);color:#1d4ed8;
              font-size:10px;font-weight:600;white-space:nowrap;
            ">${radius / 1000} km</span>`,
            iconSize: [44, 16],
            iconAnchor: [22, 8],
          }),
          interactive: false,
          zIndexOffset: -100,
        }).addTo(layer);
      }
    }
  }, [userPosition, showDistances]);

  // Toutes les couches de données, redessinées ensemble.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

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
      const marker = L.marker([real.lat, real.lng], {
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

      if (showDistances) {
        marker.bindTooltip(distanceLabel(real.distanceMeters), {
          permanent: true,
          direction: "top",
          offset: [0, -44],
          className: "distance-label distance-label--operator",
        });
      }
    }

    // -- Mes antennes --
    for (const antenna of antennas) {
      const selected = antenna.id === selectedAntennaId;
      // Distance depuis la position figée, si elle est connue.
      const distance =
        anchorLat !== null && anchorLng !== null
          ? haversineDistance(anchorLat, anchorLng, antenna.lat, antenna.lng)
          : null;

      const marker = L.marker([antenna.lat, antenna.lng], {
        icon: pinIcon(statusColor(antenna.status), "antenna", selected),
        title: antenna.name,
        zIndexOffset: selected ? 700 : 500,
      })
        .on("click", () => onSelectAntenna(antenna.id))
        .bindPopup(
          `<strong>${antenna.name}</strong><br/>${antenna.type} · ` +
            `<span style="color:${statusColor(antenna.status)}">${statusLabel(antenna.status)}</span>` +
            `<br/>Signal ${antenna.signalStrength}% · Batterie ${Math.round(antenna.battery)}%` +
            (distance !== null ? `<br/>À ${formatDistance(distance)} de vous` : "")
        )
        .addTo(layer);

      if (showDistances && distance !== null) {
        marker.bindTooltip(distanceLabel(distance), {
          permanent: true,
          direction: "top",
          offset: [0, selected ? -54 : -44],
          className: "distance-label",
        });
      }
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
    // La position brute est volontairement absente des dépendances :
    // seule la position figée (anchor) intervient ici.
  }, [
    anchorLat,
    anchorLng,
    sites,
    antennas,
    realAntennas,
    scans,
    selectedAntennaId,
    linkTxId,
    linkRxId,
    showCoverage,
    showDistances,
    onSelectAntenna,
  ]);

  return (
    // La carte remplit son conteneur : c'est le parent qui fixe la hauteur.
    <div ref={containerRef} className="h-full w-full" style={{ background: "#eef2f7" }} />
  );
}
