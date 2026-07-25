import type { AntennaPayload, DetectedNetwork } from "./types";

/** Trame décodée depuis le port USB. */
export interface ParsedFrame {
  kind: "json" | "nmea" | "scan" | "text";
  payload?: Partial<AntennaPayload>;
  /** Réseaux captés lors d'un balayage radio du module. */
  networks?: DetectedNetwork[];
  /** Ligne brute, pour le journal. */
  raw: string;
}

/**
 * Distance approximative d'un émetteur d'après la puissance reçue.
 * Modèle log-distance : d = 10^((P₁ₘ − RSSI) / (10·n)), avec une
 * puissance de référence de −40 dBm à 1 m et un exposant de 2,7
 * (propagation en intérieur encombré).
 *
 * L'ordre de grandeur est utile, la valeur exacte ne l'est pas : murs,
 * obstacles et interférences la font varier fortement.
 */
export function estimateDistanceFromRssi(rssi: number): number {
  const referenceDbm = -40;
  const pathLossExponent = 2.7;
  if (!Number.isFinite(rssi) || rssi >= 0) return 0;
  return Math.pow(10, (referenceDbm - rssi) / (10 * pathLossExponent));
}

/** Qualité lisible d'un signal WiFi d'après son RSSI. */
export function rssiQuality(rssi: number): { label: string; percent: number } {
  // -30 dBm ≈ excellent, -90 dBm ≈ inexploitable.
  const percent = Math.round(Math.min(100, Math.max(0, ((rssi + 90) / 60) * 100)));
  if (rssi >= -50) return { label: "Excellent", percent };
  if (rssi >= -60) return { label: "Très bon", percent };
  if (rssi >= -70) return { label: "Bon", percent };
  if (rssi >= -80) return { label: "Faible", percent };
  return { label: "Très faible", percent };
}

/** Analyse une trame de balayage radio émise par le module. */
export function parseScanFrame(line: string): DetectedNetwork[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const data = JSON.parse(trimmed) as Record<string, unknown>;
    if (data.type !== "scan" || !Array.isArray(data.networks)) return null;

    const networks: DetectedNetwork[] = [];
    for (const item of data.networks) {
      if (typeof item !== "object" || item === null) continue;
      const n = item as Record<string, unknown>;
      const rssi = typeof n.rssi === "number" ? n.rssi : Number(n.rssi);
      if (!Number.isFinite(rssi)) continue;
      networks.push({
        ssid: typeof n.ssid === "string" && n.ssid.length > 0 ? n.ssid : "(réseau masqué)",
        bssid: typeof n.bssid === "string" ? n.bssid : undefined,
        rssi,
        channel: typeof n.channel === "number" ? n.channel : undefined,
        encryption: typeof n.enc === "string" ? n.enc : undefined,
      });
    }
    return networks.length > 0 ? networks.sort((a, b) => b.rssi - a.rssi) : null;
  } catch {
    return null;
  }
}

/**
 * Convertit une coordonnée NMEA (ddmm.mmmm / dddmm.mmmm) en degrés décimaux.
 * Ex. "4807.038","N" → 48.1173
 */
export function nmeaToDecimal(value: string, hemisphere: string): number | null {
  const num = Number(value);
  if (!value || !Number.isFinite(num)) return null;
  const degrees = Math.floor(num / 100);
  const minutes = num - degrees * 100;
  let decimal = degrees + minutes / 60;
  const h = hemisphere.toUpperCase();
  if (h === "S" || h === "W") decimal = -decimal;
  return Number.isFinite(decimal) ? decimal : null;
}

/**
 * Analyse une phrase NMEA d'un module GPS (NEO-6M, u-blox…).
 * Prend en charge GGA (position + satellites) et RMC (position + validité),
 * pour les préfixes GP (GPS) et GN (multi-constellation).
 */
export function parseNmea(line: string): Partial<AntennaPayload> | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("$")) return null;

  // Retirer la somme de contrôle (*XX) puis découper.
  const parts = trimmed.split("*")[0].split(",");
  const type = parts[0].slice(3); // GPGGA → GGA

  if (type === "GGA") {
    // $--GGA,heure,lat,N/S,lng,E/W,qualité,satellites,...
    const quality = Number(parts[6]);
    if (!quality) return null; // 0 = pas de fix
    const lat = nmeaToDecimal(parts[2], parts[3]);
    const lng = nmeaToDecimal(parts[4], parts[5]);
    if (lat === null || lng === null) return null;
    const satellites = Number(parts[7]);
    return {
      lat,
      lng,
      ...(Number.isFinite(satellites) ? { satellites } : {}),
    };
  }

  if (type === "RMC") {
    // $--RMC,heure,statut,lat,N/S,lng,E/W,vitesse,...
    if (parts[2] !== "A") return null; // V = données invalides
    const lat = nmeaToDecimal(parts[3], parts[4]);
    const lng = nmeaToDecimal(parts[5], parts[6]);
    if (lat === null || lng === null) return null;
    return { lat, lng };
  }

  return null;
}

/** Champs numériques acceptés depuis une trame JSON du module. */
const NUMERIC_FIELDS = [
  "signalStrength",
  "temperature",
  "humidity",
  "battery",
  "connectedDevices",
  "lat",
  "lng",
  "satellites",
] as const;

/** Analyse une ligne JSON envoyée par le firmware. */
export function parseJsonFrame(line: string): Partial<AntennaPayload> | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const data = JSON.parse(trimmed) as Record<string, unknown>;
    const payload: Partial<AntennaPayload> = {};

    if (typeof data.antennaId === "string") payload.antennaId = data.antennaId;
    for (const field of NUMERIC_FIELDS) {
      const value = data[field];
      if (typeof value === "number" && Number.isFinite(value)) {
        payload[field] = value;
      }
    }
    return Object.keys(payload).length > 0 ? payload : null;
  } catch {
    return null;
  }
}

/** Analyse une ligne quelconque reçue sur le port série. */
export function parseSerialLine(line: string): ParsedFrame {
  const raw = line.trim();

  // Le balayage radio est testé avant la télémétrie : les deux sont du
  // JSON, mais seul le premier porte un champ "type": "scan".
  const networks = parseScanFrame(raw);
  if (networks) return { kind: "scan", networks, raw };

  const json = parseJsonFrame(raw);
  if (json) return { kind: "json", payload: json, raw };

  const nmea = parseNmea(raw);
  if (nmea) return { kind: "nmea", payload: nmea, raw };

  return { kind: "text", raw };
}
