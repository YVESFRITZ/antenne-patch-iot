import type { AntennaStatus } from "@/lib/types";

export function statusColor(status: AntennaStatus): string {
  const colors: Record<AntennaStatus, string> = {
    online: "#22c55e",
    warning: "#f59e0b",
    offline: "#ef4444",
    idle: "#64748b",
  };
  return colors[status];
}

export function statusLabel(status: AntennaStatus): string {
  const labels: Record<AntennaStatus, string> = {
    online: "En ligne",
    warning: "Alerte",
    offline: "Hors ligne",
    idle: "Inactif",
  };
  return labels[status];
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function signalBars(strength: number): number {
  if (strength >= 80) return 4;
  if (strength >= 60) return 3;
  if (strength >= 40) return 2;
  if (strength > 0) return 1;
  return 0;
}

/* ------------------------------------------------------------------ */
/* Calcul de liaison émetteur → récepteur                             */
/* ------------------------------------------------------------------ */

const EARTH_RADIUS_M = 6_371_000;

/**
 * Distance géodésique (formule de Haversine) entre deux points GPS.
 * @returns distance en mètres
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Formate une distance en mètres vers m / km lisibles. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  if (meters < 100000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters / 1000)} km`;
}

/** Azimut (cap) du point 1 vers le point 2, en degrés (0 = Nord). */
export function bearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Point cardinal (N, NE, E, …) à partir d'un azimut en degrés. */
export function cardinalDirection(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}

/** Fréquence radio typique (MHz) selon le type d'antenne. */
export function typicalFrequencyMHz(type: string): number {
  const map: Record<string, number> = {
    LoRa: 868,
    "4G": 1800,
    WiFi: 2400,
    Satellite: 1575,
  };
  return map[type] ?? 868;
}

/**
 * Affaiblissement en espace libre (Free Space Path Loss).
 * FSPL(dB) = 20·log10(d_km) + 20·log10(f_MHz) + 32.44
 * @returns perte en dB (0 si distance nulle)
 */
export function freeSpacePathLoss(distanceMeters: number, freqMHz: number): number {
  if (distanceMeters <= 0) return 0;
  const dKm = distanceMeters / 1000;
  return 20 * Math.log10(dKm) + 20 * Math.log10(freqMHz) + 32.44;
}

/** Portée théorique de la ligne d'horizon radio (km) selon la hauteur (m). */
export function radioHorizonKm(heightMeters: number): number {
  return 4.12 * Math.sqrt(Math.max(0, heightMeters));
}

export interface LinkBudget {
  distanceMeters: number;
  bearingDeg: number;
  cardinal: string;
  freqMHz: number;
  fsplDb: number;
  /** Marge de liaison estimée (dB) : positif = liaison viable. */
  linkMarginDb: number;
  quality: "excellent" | "bon" | "limite" | "hors_portee";
  qualityLabel: string;
}

/**
 * Bilan de liaison entre un émetteur et un récepteur.
 * Modèle simplifié : puissance émise + gains − FSPL comparé à la
 * sensibilité du récepteur. La qualité mesurée des deux modules
 * (signalStrength 0-100) pondère la marge finale.
 */
export function computeLinkBudget(params: {
  lat1: number;
  lng1: number;
  lat2: number;
  lng2: number;
  freqMHz: number;
  /** PIRE émetteur (dBm), défaut 14 dBm (25 mW, ISM). */
  txPowerDbm?: number;
  /** Sensibilité récepteur (dBm), défaut -120 dBm (typique LoRa). */
  rxSensitivityDbm?: number;
  /** Qualité mesurée émetteur 0-100. */
  txSignal?: number;
  /** Qualité mesurée récepteur 0-100. */
  rxSignal?: number;
}): LinkBudget {
  const {
    lat1,
    lng1,
    lat2,
    lng2,
    freqMHz,
    txPowerDbm = 14,
    rxSensitivityDbm = -120,
    txSignal = 100,
    rxSignal = 100,
  } = params;

  const distanceMeters = haversineDistance(lat1, lng1, lat2, lng2);
  const bearingDeg = bearing(lat1, lng1, lat2, lng2);
  const fsplDb = freeSpacePathLoss(distanceMeters, freqMHz);

  // Puissance reçue = PIRE − FSPL. Marge = Prx − sensibilité.
  const rxPowerDbm = txPowerDbm - fsplDb;
  const rawMargin = rxPowerDbm - rxSensitivityDbm;

  // Pondération par l'état réel des deux modules (0.5 → 1.0).
  const health = (0.5 + (txSignal / 100) * 0.25 + (rxSignal / 100) * 0.25);
  const linkMarginDb = rawMargin * health;

  let quality: LinkBudget["quality"];
  let qualityLabel: string;
  if (linkMarginDb <= 0) {
    quality = "hors_portee";
    qualityLabel = "Hors de portée";
  } else if (linkMarginDb < 10) {
    quality = "limite";
    qualityLabel = "Liaison limite";
  } else if (linkMarginDb < 25) {
    quality = "bon";
    qualityLabel = "Bonne liaison";
  } else {
    quality = "excellent";
    qualityLabel = "Excellente liaison";
  }

  return {
    distanceMeters,
    bearingDeg,
    cardinal: cardinalDirection(bearingDeg),
    freqMHz,
    fsplDb,
    linkMarginDb,
    quality,
    qualityLabel,
  };
}
