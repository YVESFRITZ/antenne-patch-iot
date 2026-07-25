import type { AntennaPayload } from "./types";

/** Trame décodée depuis le port USB. */
export interface ParsedFrame {
  kind: "json" | "nmea" | "text";
  payload?: Partial<AntennaPayload>;
  /** Ligne brute, pour le journal. */
  raw: string;
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

  const json = parseJsonFrame(raw);
  if (json) return { kind: "json", payload: json, raw };

  const nmea = parseNmea(raw);
  if (nmea) return { kind: "nmea", payload: nmea, raw };

  return { kind: "text", raw };
}
