import { readJson, writeJson } from "./persistence";
import type { TelemetryPoint } from "./types";

/**
 * Historique long terme : au lieu de conserver chaque mesure (une toutes
 * les 10 s, soit ~260 000 points par mois et par antenne), on agrège par
 * heure. 30 jours tiennent alors en 720 points par antenne, ce qui reste
 * léger à stocker et à transmettre.
 */

const HISTORY_KEY = "history";
/** Nombre d'heures conservées (30 jours). */
const RETENTION_HOURS = 24 * 30;

export interface HourlyBucket {
  /** Début de l'heure, au format ISO. */
  hour: string;
  /** Nombre de mesures agrégées. */
  count: number;
  signalAvg: number;
  signalMin: number;
  signalMax: number;
  temperatureAvg: number;
  temperatureMin: number;
  temperatureMax: number;
  humidityAvg: number;
  batteryAvg: number;
  batteryMin: number;
}

/** Historique de toutes les antennes, indexé par identifiant. */
export type HistoryStore = Record<string, HourlyBucket[]>;

export type HistoryRange = "24h" | "7d" | "30d";

export const RANGE_HOURS: Record<HistoryRange, number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
};

/** Début de l'heure contenant la date donnée. */
export function hourKey(date: Date = new Date()): string {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

/** Intègre une mesure dans le seau horaire correspondant. */
export function addSample(
  buckets: HourlyBucket[],
  point: TelemetryPoint
): HourlyBucket[] {
  const key = hourKey(new Date(point.timestamp));
  const last = buckets[buckets.length - 1];

  if (last && last.hour === key) {
    // Moyennes glissantes : on évite de conserver chaque échantillon.
    const n = last.count + 1;
    const merged: HourlyBucket = {
      hour: key,
      count: n,
      signalAvg: (last.signalAvg * last.count + point.signalStrength) / n,
      signalMin: Math.min(last.signalMin, point.signalStrength),
      signalMax: Math.max(last.signalMax, point.signalStrength),
      temperatureAvg: (last.temperatureAvg * last.count + point.temperature) / n,
      temperatureMin: Math.min(last.temperatureMin, point.temperature),
      temperatureMax: Math.max(last.temperatureMax, point.temperature),
      humidityAvg: (last.humidityAvg * last.count + point.humidity) / n,
      batteryAvg: (last.batteryAvg * last.count + point.battery) / n,
      batteryMin: Math.min(last.batteryMin, point.battery),
    };
    return [...buckets.slice(0, -1), merged];
  }

  const fresh: HourlyBucket = {
    hour: key,
    count: 1,
    signalAvg: point.signalStrength,
    signalMin: point.signalStrength,
    signalMax: point.signalStrength,
    temperatureAvg: point.temperature,
    temperatureMin: point.temperature,
    temperatureMax: point.temperature,
    humidityAvg: point.humidity,
    batteryAvg: point.battery,
    batteryMin: point.battery,
  };
  const next = [...buckets, fresh];
  return next.length > RETENTION_HOURS ? next.slice(next.length - RETENTION_HOURS) : next;
}

/** Ne conserve que les seaux compris dans la période demandée. */
export function filterRange(buckets: HourlyBucket[], range: HistoryRange): HourlyBucket[] {
  const since = Date.now() - RANGE_HOURS[range] * 3600_000;
  return buckets.filter((b) => new Date(b.hour).getTime() >= since);
}

export async function loadHistory(): Promise<HistoryStore> {
  return (await readJson<HistoryStore>(HISTORY_KEY)) ?? {};
}

export async function saveHistory(history: HistoryStore): Promise<void> {
  await writeJson(HISTORY_KEY, history);
}

/** Échappe une valeur pour le format CSV. */
function csvCell(value: string | number): string {
  const text = String(value);
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface CsvRowSource {
  antennaId: string;
  antennaName: string;
  siteName: string;
  buckets: HourlyBucket[];
}

/** Construit un fichier CSV à partir de l'historique agrégé. */
export function toCsv(sources: CsvRowSource[]): string {
  const header = [
    "antenne_id",
    "antenne_nom",
    "site",
    "heure",
    "mesures",
    "signal_moyen",
    "signal_min",
    "signal_max",
    "temperature_moyenne",
    "temperature_min",
    "temperature_max",
    "humidite_moyenne",
    "batterie_moyenne",
    "batterie_min",
  ];

  const round = (n: number) => Math.round(n * 10) / 10;
  const lines = [header.join(",")];

  for (const source of sources) {
    for (const b of source.buckets) {
      lines.push(
        [
          source.antennaId,
          source.antennaName,
          source.siteName,
          b.hour,
          b.count,
          round(b.signalAvg),
          round(b.signalMin),
          round(b.signalMax),
          round(b.temperatureAvg),
          round(b.temperatureMin),
          round(b.temperatureMax),
          round(b.humidityAvg),
          round(b.batteryAvg),
          round(b.batteryMin),
        ]
          .map(csvCell)
          .join(",")
      );
    }
  }

  return lines.join("\n");
}
